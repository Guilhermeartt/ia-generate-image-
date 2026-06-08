from __future__ import annotations

import base64
import io
import os
from typing import Any, Optional

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from PIL import Image
from transformers import (
    DetrForObjectDetection,
    DetrImageProcessor,
    Sam2Config,
    Sam2Model,
    Sam2Processor,
)


MODEL_ID = os.environ.get("SAM2_MODEL_ID", "facebook/sam2.1-hiera-large")
DETECTOR_ID = os.environ.get("DETECTOR_ID", "facebook/detr-resnet-50")
DEVICE = os.environ.get("SAM2_DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")

app = FastAPI(title="SAM 2 segmentation service")
processor: Sam2Processor | None = None
model: Sam2Model | None = None
detector_processor: DetrImageProcessor | None = None
detector_model: DetrForObjectDetection | None = None


def _build_image_config(model_id: str) -> Sam2Config:
    # facebook/sam2.1-* checkpoints declaram model_type "sam2_video" no config.json,
    # mas contêm os pesos image-only que Sam2Model precisa. Reconstruímos uma
    # Sam2Config explícita para não cair na auto-detecção (que avisaria mismatch).
    config_dict, _ = Sam2Config.get_config_dict(model_id)
    return Sam2Config(
        vision_config=config_dict.get("vision_config"),
        prompt_encoder_config=config_dict.get("prompt_encoder_config"),
        mask_decoder_config=config_dict.get("mask_decoder_config"),
        initializer_range=config_dict.get("initializer_range", 0.02),
    )


class Point(BaseModel):
    x: float
    y: float


class Box(BaseModel):
    x: float
    y: float
    width: float
    height: float


class SegmentRequest(BaseModel):
    imageBase64: str
    point: Optional[Point] = None
    positivePoints: list[Point] = []
    negativePoints: list[Point] = []
    box: Optional[Box] = None  # normalized [0,1] bbox prompt
    multimask: bool = False


class DetectRequest(BaseModel):
    imageBase64: str
    threshold: float = 0.7
    maxObjects: int = 20


def load_model() -> tuple[Sam2Processor, Sam2Model]:
    global processor, model
    if processor is None:
        processor = Sam2Processor.from_pretrained(MODEL_ID)
    if model is None:
        image_config = _build_image_config(MODEL_ID)
        model = Sam2Model.from_pretrained(MODEL_ID, config=image_config).to(DEVICE).eval()
    return processor, model


def load_detector() -> tuple[DetrImageProcessor, DetrForObjectDetection]:
    global detector_processor, detector_model
    if detector_processor is None:
        detector_processor = DetrImageProcessor.from_pretrained(DETECTOR_ID)
    if detector_model is None:
        detector_model = DetrForObjectDetection.from_pretrained(DETECTOR_ID).to(DEVICE).eval()
    return detector_processor, detector_model


def decode_image(data_url: str) -> Image.Image:
    raw = data_url.split(",", 1)[1] if "," in data_url else data_url
    try:
        return Image.open(io.BytesIO(base64.b64decode(raw))).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="imageBase64 inválida.") from exc


def encode_mask(mask: np.ndarray) -> str:
    mask_img = Image.fromarray((mask.astype(np.uint8) * 255), mode="L")
    output = io.BytesIO()
    mask_img.save(output, format="PNG")
    return "data:image/png;base64," + base64.b64encode(output.getvalue()).decode("utf-8")


def mask_bbox(mask: np.ndarray) -> dict[str, int]:
    ys, xs = np.where(mask > 0)
    if xs.size == 0 or ys.size == 0:
        return {"x": 0, "y": 0, "width": 1, "height": 1}
    min_x = int(xs.min())
    max_x = int(xs.max())
    min_y = int(ys.min())
    max_y = int(ys.max())
    return {
        "x": min_x,
        "y": min_y,
        "width": max(1, max_x - min_x),
        "height": max(1, max_y - min_y),
    }


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "model": MODEL_ID, "device": DEVICE, "loaded": model is not None}


@app.post("/detect")
def detect(req: DetectRequest) -> dict[str, Any]:
    image = decode_image(req.imageBase64)
    width, height = image.size
    det_processor, det_model = load_detector()
    inputs = det_processor(images=image, return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        outputs = det_model(**inputs)
    target_sizes = torch.tensor([[height, width]], device=DEVICE)
    results = det_processor.post_process_object_detection(
        outputs, target_sizes=target_sizes, threshold=req.threshold
    )[0]

    items = []
    for score, label, box in zip(
        results["scores"].detach().cpu().tolist(),
        results["labels"].detach().cpu().tolist(),
        results["boxes"].detach().cpu().tolist(),
    ):
        x1, y1, x2, y2 = box
        items.append({
            "label": det_model.config.id2label.get(int(label), str(label)),
            "score": float(score),
            "bbox": {
                "x": float(x1) / width,
                "y": float(y1) / height,
                "width": float(x2 - x1) / width,
                "height": float(y2 - y1) / height,
            },
            "bboxPixels": {
                "x": int(x1),
                "y": int(y1),
                "width": int(x2 - x1),
                "height": int(y2 - y1),
            },
        })
    items.sort(key=lambda d: d["score"], reverse=True)
    items = items[: req.maxObjects]
    return {"objects": items, "width": width, "height": height}


@app.post("/segment")
def segment(req: SegmentRequest) -> dict[str, Any]:
    image = decode_image(req.imageBase64)
    width, height = image.size

    positive = ([req.point] if req.point is not None else []) + list(req.positivePoints)
    points: list[list[int]] = []
    labels: list[int] = []
    for p in positive:
        points.append([
            int(max(0, min(1, p.x)) * width),
            int(max(0, min(1, p.y)) * height),
        ])
        labels.append(1)
    for p in req.negativePoints:
        points.append([
            int(max(0, min(1, p.x)) * width),
            int(max(0, min(1, p.y)) * height),
        ])
        labels.append(0)

    if not points and req.box is None:
        raise HTTPException(status_code=400, detail="Envie ao menos um ponto ou box.")

    sam_processor, sam_model = load_model()
    processor_kwargs: dict[str, Any] = {"images": image, "return_tensors": "pt"}
    if points:
        processor_kwargs["input_points"] = [[points]]
        processor_kwargs["input_labels"] = [[labels]]
    if req.box is not None:
        b = req.box
        x1 = int(max(0, min(1, b.x)) * width)
        y1 = int(max(0, min(1, b.y)) * height)
        x2 = int(max(0, min(1, b.x + b.width)) * width)
        y2 = int(max(0, min(1, b.y + b.height)) * height)
        processor_kwargs["input_boxes"] = [[[x1, y1, x2, y2]]]
    inputs = sam_processor(**processor_kwargs).to(DEVICE)

    # multimask_output=False ativa a heurística dynamic_multimask_via_stability
    # do decoder: usa a single-best-mask quando estável, ou cai na melhor das
    # 3 multimask quando há ambiguidade. Para um ponto isolado dá máscaras
    # muito mais precisas do que pegar argmax(iou_scores) sobre 3 candidatas,
    # que tende a favorecer áreas grandes ("imagem toda").
    if req.multimask:
        with torch.no_grad():
            outputs = sam_model(**inputs, multimask_output=True)
        masks = sam_processor.post_process_masks(
            outputs.pred_masks.detach().cpu(),
            inputs["original_sizes"],
            apply_non_overlapping_constraints=True,
        )[0]
        # masks shape: (point_batch=1, num_masks=3, H, W)
        candidates = masks[0]  # (3, H, W)
        iou = outputs.iou_scores.detach().cpu()[0, 0]  # (3,)
        best = int(torch.argmax(iou).item())
        mask = candidates[best].numpy().astype(bool)
        score = float(iou[best].item())
    else:
        with torch.no_grad():
            outputs = sam_model(**inputs, multimask_output=False)
        masks = sam_processor.post_process_masks(
            outputs.pred_masks.detach().cpu(),
            inputs["original_sizes"],
            apply_non_overlapping_constraints=True,
        )[0]
        # masks shape: (point_batch=1, num_masks=1, H, W)
        mask = masks[0, 0].numpy().astype(bool)
        iou = outputs.iou_scores.detach().cpu().reshape(-1)
        score = float(iou[0].item()) if iou.numel() > 0 else None
    return {
        "maskBase64": encode_mask(mask),
        "bbox": mask_bbox(mask),
        "score": score,
        "width": width,
        "height": height,
    }
