import { act, renderHook } from '@testing-library/react-native';

import type { RenderDoc } from '@shared/api';

import { useAccount, useRecentRenders } from '../account';

const render = (id: string, status: RenderDoc['status']) => ({ id, status }) as RenderDoc;

describe('useRecentRenders', () => {
  beforeEach(async () => {
    await act(() => useAccount.getState().setRenders([]));
  });

  it('renders without an update loop when renders exist', async () => {
    await act(() => useAccount.getState().setRenders([render('a', 'succeeded'), render('b', 'failed')]));
    const { result } = await renderHook(() => useRecentRenders());
    expect(result.current.map((r) => r.id)).toEqual(['a']);
  });

  it('keeps the same array while the matching renders are unchanged', async () => {
    const renders = [render('a', 'succeeded')];
    await act(() => useAccount.getState().setRenders(renders));
    const { result, rerender } = await renderHook(() => useRecentRenders());
    const first = result.current;
    await act(() => useAccount.getState().setBackendState('ready'));
    await rerender({});
    expect(result.current).toBe(first);
  });

  it('caps the list at six succeeded renders', async () => {
    const many = Array.from({ length: 8 }, (_, i) => render(`r${i}`, 'succeeded'));
    await act(() => useAccount.getState().setRenders(many));
    const { result } = await renderHook(() => useRecentRenders());
    expect(result.current).toHaveLength(6);
  });
});
