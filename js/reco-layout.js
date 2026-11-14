/** Fit all reconciliation columns to the available sheet width. */
(function () {
    function schedule(el, value) {
        el._recoFitValue = value || {};
        if (el._recoFitFrame) return;
        el._recoFitFrame = requestAnimationFrame(() => {
            el._recoFitFrame = 0;
            const table = el.querySelector('table');
            if (!table || !el.clientWidth) return;
            const options = el._recoFitValue;
            // Leave room for collapsed borders and fractional browser zoom rounding.
            const available = Math.max(1, el.clientWidth - 6);
            const width = Math.max(available, 816 + Math.max(0, Number(options.columns) || 0) * 68);
            table.style.width = width + 'px';
            table.style.zoom = options.enabled ? String(Math.min(1, available / width)) : '1';
            if (options.enabled) el.scrollLeft = 0;
        });
    }
    window.RecoFitDirective = {
        mounted(el, binding) {
            if (typeof ResizeObserver !== 'undefined') {
                el._recoFitObserver = new ResizeObserver(() => schedule(el, el._recoFitValue));
                el._recoFitObserver.observe(el);
            } else {
                el._recoFitResize = () => schedule(el, el._recoFitValue);
                window.addEventListener('resize', el._recoFitResize);
            }
            schedule(el, binding.value);
        },
        updated(el, binding) { schedule(el, binding.value); },
        unmounted(el) {
            if (el._recoFitObserver) el._recoFitObserver.disconnect();
            if (el._recoFitResize) window.removeEventListener('resize', el._recoFitResize);
            if (el._recoFitFrame) cancelAnimationFrame(el._recoFitFrame);
        }
    };
})();
