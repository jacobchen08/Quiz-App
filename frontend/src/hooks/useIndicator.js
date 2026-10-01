import { useLayoutEffect, useState } from 'react';

// Measures the active element inside a container so one shared indicator can slide to it.
// Returns CSS custom properties for the indicator's position and size.
export default function useIndicator(containerRef, activeSelector, deps) {
  const [box, setBox] = useState(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function measure() {
      const active = container.querySelector(activeSelector);
      if (!active || active.offsetWidth === 0) return; // hidden panels have no size yet
      setBox({
        '--ind-x': `${active.offsetLeft}px`,
        '--ind-y': `${active.offsetTop}px`,
        '--ind-w': `${active.offsetWidth}px`,
        '--ind-h': `${active.offsetHeight}px`,
      });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return box;
}
