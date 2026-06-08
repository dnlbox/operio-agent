import { describe, it, expect } from 'vitest';
import { clone, pipe, compose, map, filter, reduce } from '@/utils/fp';
import { parseMarkdown, highlightKeywords } from '@/utils/markdown';
import { initialState, setView, setWeather, setTenant, appendChatMessage } from '@/state/store';

describe('Functional Programming Utilities', () => {
  it('should deeply clone objects', () => {
    const original = { a: 1, b: { c: 2 } };
    const copied = clone(original);
    expect(copied).toEqual(original);
    expect(copied).not.toBe(original);
    expect(copied.b).not.toBe(original.b);
  });

  it('should pipe value through unary functions', () => {
    const add2 = (x: number) => x + 2;
    const double = (x: number) => x * 2;
    const result = pipe(5, add2, double);
    expect(result).toBe(14); // (5 + 2) * 2
  });

  it('should compose unary functions right to left', () => {
    const add2 = (x: number) => x + 2;
    const double = (x: number) => x * 2;
    const composed = compose(double, add2);
    expect(composed(5)).toBe(14); // double(add2(5)) = (5+2)*2 = 14
  });

  it('should execute curried map, filter, and reduce operations', () => {
    const arr = [1, 2, 3, 4, 5];
    const double = (x: number) => x * 2;
    const isEven = (x: number) => x % 2 === 0;
    const sum = (acc: number, x: number) => acc + x;

    const pipeline = compose(
      reduce(sum, 0),
      filter(isEven),
      map(double)
    );

    const result = pipeline(arr);
    // map: [2, 4, 6, 8, 10]
    // filter: [2, 4, 6, 8, 10] (all are even)
    // reduce: 2 + 4 + 6 + 8 + 10 = 30
    expect(result).toBe(30);
  });
});

describe('State Reducer Logic (Immutable Updates)', () => {
  it('should set active view state', () => {
    const state1 = setView('tenanthub')(initialState);
    expect(state1.activeView).toBe('tenanthub');
    expect(state1).not.toBe(initialState);
  });

  it('should update weather alerts', () => {
    const state = setWeather('-5°C', 'Flurries', 'Winter Storm Alert')(initialState);
    expect(state.weather).toEqual({
      temp: '-5°C',
      desc: 'Flurries',
      alert: 'Winter Storm Alert'
    });
  });

  it('should set active tenant and swap context lease info', () => {
    const state = setTenant('tenant_002')(initialState);
    expect(state.currentTenant).toBe('tenant_002');
    expect(state.currentLeaseId).toBe('lease_adidas_105');
    expect(state.chatSessionId).toBeNull();
    expect(state.chatMessages[0].content).toContain('Adidas Store');
  });

  it('should append chat messages in order', () => {
    const state = appendChatMessage({ role: 'user', content: 'test message' })(initialState);
    expect(state.chatMessages.length).toBe(initialState.chatMessages.length + 1);
    expect(state.chatMessages[state.chatMessages.length - 1]).toEqual({
      role: 'user',
      content: 'test message'
    });
  });
});

describe('Markdown & Formatting Parser', () => {
  it('should transform headings, bold texts, and link citation markers', () => {
    const md = '### Clause 9.1\n* item 1\nCheck Section 9.1 for more.';
    const parsed = parseMarkdown(md);
    expect(parsed).toContain('<h3>Clause 9.1</h3>');
    expect(parsed).toContain('<li>item 1</li>');
    expect(parsed).toContain('<span class="citation-btn" data-ref="Section 9.1">Section 9.1</span>');
  });

  it('should highlight searched terms', () => {
    const content = 'The storefront HVAC is broken. Please fix.';
    const highlighted = highlightKeywords(content, 'HVAC broken');
    expect(highlighted).toContain('<mark class="query-highlight">HVAC</mark>');
    expect(highlighted).toContain('<mark class="query-highlight">broken</mark>');
  });
});
