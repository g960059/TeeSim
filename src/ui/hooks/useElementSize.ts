import { useLayoutEffect, useState, type RefObject } from 'react';

interface ElementSize {
  width: number;
  height: number;
}

export function useElementSize<T extends HTMLElement>(ref: RefObject<T | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>({ height: 0, width: 0 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const updateSize = (): void => {
      const next = {
        height: element.clientHeight,
        width: element.clientWidth,
      };

      // Only update state if dimensions actually changed — prevents
      // feedback loops where VTK.js canvas resize triggers ResizeObserver
      // which triggers re-render which triggers canvas resize...
      setSize((prev) =>
        prev.width === next.width && prev.height === next.height ? prev : next,
      );
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return size;
}
