#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# start.sh — sobe toda a stack do gerador de imagem
#   • SAM2 + DETR     (Python/FastAPI/uvicorn)  porta 8791
#   • API geminiProxy (Node/Express)            porta 8787
#   • Vite dev server (React)                   porta 3000 (cai p/ 3001 se ocupada)
#
# Uso:
#   ./start.sh                # sobe os 3 serviços
#   ./start.sh --no-sam2      # sobe só Vite + API (sem segmentação SAM2)
#   ./start.sh --restart      # mata instâncias antigas nas portas antes de subir
#   ./start.sh --help         # mostra essa ajuda
#
# Encerra todos os filhos com Ctrl+C.
# ──────────────────────────────────────────────────────────────────────

set -u

# Cores
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
BLUE='\033[0;34m'; PURPLE='\033[0;35m'; CYAN='\033[0;36m'
BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

# Caminho da raiz do projeto (onde este script vive)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# ── Flags ───────────────────────────────────────────────────────────
SKIP_SAM2=0
RESTART=0
for arg in "$@"; do
  case "$arg" in
    --no-sam2)  SKIP_SAM2=1 ;;
    --restart)  RESTART=1 ;;
    --help|-h)
      sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      echo -e "${RED}Flag desconhecida: $arg${NC} — veja --help" >&2
      exit 1 ;;
  esac
done

# ── Descobrir node/npm ──────────────────────────────────────────────
find_node_bin() {
  if command -v npm >/dev/null 2>&1; then
    dirname "$(command -v npm)"
    return 0
  fi
  # nvm via Herd (caso típico desta máquina)
  local herd_nvm="$HOME/Library/Application Support/Herd/config/nvm/versions/node"
  if [ -d "$herd_nvm" ]; then
    local latest
    latest=$(ls -1 "$herd_nvm" 2>/dev/null | sort -V | tail -1)
    [ -n "$latest" ] && [ -x "$herd_nvm/$latest/bin/npm" ] && {
      echo "$herd_nvm/$latest/bin"; return 0;
    }
  fi
  # nvm padrão
  if [ -d "$HOME/.nvm/versions/node" ]; then
    local latest
    latest=$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | sort -V | tail -1)
    [ -n "$latest" ] && [ -x "$HOME/.nvm/versions/node/$latest/bin/npm" ] && {
      echo "$HOME/.nvm/versions/node/$latest/bin"; return 0;
    }
  fi
  return 1
}

NODE_BIN="$(find_node_bin || true)"
if [ -z "$NODE_BIN" ]; then
  echo -e "${RED}✗ npm/node não encontrado.${NC} Instale Node ou ajuste o PATH em start.sh." >&2
  exit 1
fi
export PATH="$NODE_BIN:$PATH"

# ── Checks ──────────────────────────────────────────────────────────
[ -d "node_modules" ] || {
  echo -e "${YELLOW}node_modules ausente — rodando 'npm install' …${NC}"
  npm install || { echo -e "${RED}✗ npm install falhou${NC}"; exit 1; }
}

VENV_DIR=".venv-sam2"
if [ $SKIP_SAM2 -eq 0 ]; then
  if [ ! -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}venv $VENV_DIR ausente — criando e instalando deps Python…${NC}"
    python3 -m venv "$VENV_DIR" || { echo -e "${RED}✗ falha ao criar venv${NC}"; exit 1; }
    "$VENV_DIR/bin/pip" install --upgrade pip >/dev/null
    "$VENV_DIR/bin/pip" install -r server/sam2-requirements.txt \
      || { echo -e "${RED}✗ falha ao instalar deps Python${NC}"; exit 1; }
  fi
fi

# ── Portas em uso ───────────────────────────────────────────────────
port_pid() { lsof -ti:"$1" 2>/dev/null | head -1; }

free_port_if_restart() {
  local port="$1" name="$2"
  local pid
  pid="$(port_pid "$port")"
  if [ -n "$pid" ]; then
    if [ $RESTART -eq 1 ]; then
      echo -e "${YELLOW}↻ matando $name (porta $port, PID $pid)${NC}"
      kill "$pid" 2>/dev/null
      sleep 2
    else
      echo -e "${RED}✗ porta $port já em uso (PID $pid) — $name${NC}"
      echo -e "${DIM}  use --restart para derrubar, ou pare manualmente: kill $pid${NC}"
      exit 1
    fi
  fi
}

[ $SKIP_SAM2 -eq 0 ] && free_port_if_restart 8791 "SAM2"
free_port_if_restart 8787 "API"
free_port_if_restart 3000 "Vite"

# ── Shutdown handler ────────────────────────────────────────────────
PIDS=()
shutdown() {
  echo -e "\n${YELLOW}↓ Encerrando serviços…${NC}"
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done
  # Pequeno wait para limpeza graceful, depois forçar
  sleep 1
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null || true
  done
  echo -e "${DIM}encerrado.${NC}"
  exit 0
}
trap shutdown INT TERM

# ── Prefix helper: prefixa cada linha de stdout com [tag] colorido ─
run_tagged() {
  local color="$1" tag="$2"; shift 2
  ( "$@" 2>&1 | while IFS= read -r line; do
      printf '%b[%s]%b %s\n' "$color$BOLD" "$tag" "$NC" "$line"
    done ) &
  PIDS+=($!)
}

clear
echo -e "${BOLD}${CYAN}╭──────────────────────────────────────────────────╮${NC}"
echo -e "${BOLD}${CYAN}│${NC}  ${BOLD}Gerador de Imagem — dev stack${NC}                   ${BOLD}${CYAN}│${NC}"
echo -e "${BOLD}${CYAN}╰──────────────────────────────────────────────────╯${NC}"
echo
if [ $SKIP_SAM2 -eq 0 ]; then
  echo -e "  ${PURPLE}●${NC} SAM2 + DETR     ${DIM}→${NC} http://127.0.0.1:8791"
fi
echo -e "  ${GREEN}●${NC} API geminiProxy ${DIM}→${NC} http://localhost:8787"
echo -e "  ${BLUE}●${NC} Vite frontend   ${DIM}→${NC} http://localhost:3000  ${DIM}(fallback :3001)${NC}"
echo
echo -e "${DIM}Ctrl+C para encerrar tudo.${NC}"
echo

# ── Subir serviços ──────────────────────────────────────────────────
if [ $SKIP_SAM2 -eq 0 ]; then
  run_tagged "$PURPLE" "sam2" \
    "$VENV_DIR/bin/uvicorn" server.sam2_service:app --host 127.0.0.1 --port 8791
fi

run_tagged "$GREEN" "api " node server/geminiProxy.mjs
run_tagged "$BLUE"  "vite" npm run dev

# Espera qualquer filho terminar — se um cair, derrubamos tudo
wait -n 2>/dev/null || wait
shutdown
