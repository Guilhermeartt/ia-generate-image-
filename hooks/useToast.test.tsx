// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from './useToast';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useToast', () => {
  it('começa sem toast', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBeNull();
  });

  it('exibe um toast com mensagem e tipo', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('Salvo!', 'success'));
    expect(result.current.toast?.message).toBe('Salvo!');
    expect(result.current.toast?.type).toBe('success');
  });

  it('usa "success" como tipo padrão', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('Olá'));
    expect(result.current.toast?.type).toBe('success');
  });

  it('some sozinho após 3.2s', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('Some logo'));
    expect(result.current.toast).not.toBeNull();
    act(() => vi.advanceTimersByTime(3200));
    expect(result.current.toast).toBeNull();
  });

  it('dismissToast remove imediatamente', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('X'));
    act(() => result.current.dismissToast());
    expect(result.current.toast).toBeNull();
  });

  it('um novo toast reinicia o timer do anterior', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('Primeiro'));
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.showToast('Segundo'));
    act(() => vi.advanceTimersByTime(300));
    // ainda visível (timer reiniciou no segundo)
    expect(result.current.toast?.message).toBe('Segundo');
  });
});
