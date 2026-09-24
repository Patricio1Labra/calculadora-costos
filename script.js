const IVA_RATE = 0.19;

const TAX_RATES = {
    none: 0,
    analcoholicas: 0.084,
    harina: 0.10,
    alto_azucar: 0.15,
    vinos_cervezas: 0.17,
    licores_26: 0.26,
    licores_27: 0.27,
    carne: 0.042,
    custom: null
};

const TAX_LABELS = {
    none: '',
    analcoholicas: 'Bebidas analcohólicas (10% SII, aplica 8,4%)',
    harina: 'Harina (10%)',
    alto_azucar: 'Bebidas altas en azúcar (18% SII, aplica 15%)',
    vinos_cervezas: 'Vinos/Cervezas (20,5% SII, aplica 17%)',
    licores_26: 'Licores/Destilados (31,5% SII, aplica 26%)',
    licores_27: 'Licores/Destilados (31,5% SII, aplica 27%)',
    carne: 'Carne (5% SII, aplica 4,2%)',
    custom: 'Impuesto personalizado'
};

const UNIT_LABELS = {
    unidades: { singular: 'Unidad', plural: 'Unidades', lower: 'unidad' },
    gramos: { singular: 'Gramo', plural: 'Gramos', lower: 'gramo' },
    kilos: { singular: 'Kilo', plural: 'Kilos', lower: 'kilo' }
};

function getUnitLabels() {
    const unitType = (document.getElementById('unitType') || {}).value || 'unidades';
    return UNIT_LABELS[unitType] || UNIT_LABELS.unidades;
}

function updateUnitLabels() {
    const u = getUnitLabels();
    const customMargin = parseFloat((document.getElementById('marginPercentage') || {}).value) || 0;
    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    set('lblTotalUnits', `Total ${u.plural}`);
    set('lblCostBaseCard', `Costo base / ${u.singular}`);
    set('lblCostTotalCard', `Costo + ILA / ${u.singular}`);
    set('lblSaleUnitTitle', u.lower);
    if (customMargin > 0) {
        set('lblCustomMargin', `Margen ${customMargin}%`);
    } else {
        set('lblCustomMargin', 'Margen personalizado');
    }
}

const form = document.getElementById('calculatorForm');
const taxType = document.getElementById('taxType');
const unitType = document.getElementById('unitType');
const customTaxGroup = document.getElementById('customTaxGroup');
const ilaHelpBtn = document.getElementById('ilaHelpBtn');
const ilaModal = document.getElementById('ilaModal');
const ilaModalClose = document.getElementById('ilaModalClose');

const inputs = form.querySelectorAll('input, select');

// Animated counter state
let currentValues = {};
let animationFrames = {};

inputs.forEach(input => {
    input.addEventListener('input', calculate);
    input.addEventListener('change', calculate);

    // Add focus animations
    input.addEventListener('focus', function() {
        this.parentElement.classList.add('focused');
        // Seleccionar todo el texto con un solo clic/foco
        if (this.tagName === 'INPUT' && this.value) {
            this.select();
        }
    });

    input.addEventListener('blur', function() {
        this.parentElement.classList.remove('focused');
    });

    // Seleccionar contenido al hacer clic (incluso si ya tenía foco)
    // y evitar que el mouseup deseleccione en Chrome/desktop
    if (input.tagName === 'INPUT') {
        input.addEventListener('click', function() {
            if (this.value) {
                this.select();
            }
        });

        input.addEventListener('mouseup', function(e) {
            if (document.activeElement === this && this.value) {
                e.preventDefault();
            }
        });
    }
});

// Custom select styling
taxType.addEventListener('change', () => {
    customTaxGroup.style.display = taxType.value === 'custom' ? 'flex' : 'none';

    // Animate the custom field appearance
    if (taxType.value === 'custom') {
        customTaxGroup.style.opacity = '0';
        customTaxGroup.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            customTaxGroup.style.transition = 'all 0.3s ease';
            customTaxGroup.style.opacity = '1';
            customTaxGroup.style.transform = 'translateY(0)';
        }, 10);
    }

    calculate();
});

if (unitType) {
    unitType.addEventListener('change', () => {
        updateUnitLabels();
        calculate();
    });
}

ilaHelpBtn.addEventListener('click', () => {
    ilaModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    // Focus trap
    ilaModalClose.focus();
});

ilaModalClose.addEventListener('click', closeModal);

ilaModal.addEventListener('click', (e) => {
    if (e.target === ilaModal) closeModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ilaModal.style.display === 'flex') {
        closeModal();
    }
});

function closeModal() {
    ilaModal.style.display = 'none';
    document.body.style.overflow = '';
    ilaHelpBtn.focus();
}

document.getElementById('resetBtn').addEventListener('click', () => {
    // Add animation class
    const resetBtn = document.getElementById('resetBtn');
    resetBtn.style.transform = 'scale(0.95)';
    setTimeout(() => {
        resetBtn.style.transform = '';
    }, 150);

    form.reset();
    customTaxGroup.style.display = 'none';
    currentValues = {};
    calculate();

    // Focus first input after reset
    document.getElementById('totalBoxes').focus();
});

// Animated value setter with smooth transition
function animateValue(elementId, newValue, isFormatted = true) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const targetText = isFormatted ? formatCLP(newValue) : newValue.toLocaleString('es-CL');

    if (currentValues[elementId] === targetText) return;

    // Add tick animation
    element.classList.remove('animating');
    void element.offsetWidth; // Trigger reflow
    element.classList.add('animating');

    // Update value, preserving <strong> if present
    const strong = element.querySelector('strong');
    if (strong) {
        strong.textContent = targetText;
    } else {
        element.textContent = targetText;
    }

    // Remove animation class after it completes
    setTimeout(() => {
        element.classList.remove('animating');
    }, 300);

    currentValues[elementId] = targetText;
}

function calculate() {
    updateUnitLabels();
    const productsPerBox = parseFloat(document.getElementById('productsPerBox').value) || 0;
    const totalBoxes = parseFloat(document.getElementById('totalBoxes').value) || 0;
    const basePrice = parseFloat(document.getElementById('basePrice').value) || 0;
    const priceIncludesIva = document.getElementById('priceIncludesIva').value === 'yes';
    const taxTypeValue = taxType.value;
    const customTaxPercent = parseFloat(document.getElementById('customTaxPercent').value) || 0;
    const transportCost = parseFloat(document.getElementById('transportCost').value) || 0;
    const totalBoxesInFreight = parseFloat(document.getElementById('totalBoxesInFreight').value) || 1;
    const marginPercentage = parseFloat(document.getElementById('marginPercentage').value) || 0;

    if (productsPerBox <= 0 || totalBoxes <= 0 || basePrice <= 0) {
        resetResults();
        return;
    }

    const totalUnits = productsPerBox * totalBoxes;

    let taxRate = TAX_RATES[taxTypeValue];
    if (taxTypeValue === 'custom') {
        taxRate = customTaxPercent / 100;
    }

    // El precio base es el TOTAL (neto o con IVA) por todas las unidades,
    // sean 1 o 20 cajas: totalUnidades = productosPorCaja * totalCajas
    let ivaPerUnit;
    let costPerUnitBase;

    if (priceIncludesIva) {
        const totalWithIvaPerUnit = basePrice / totalUnits;
        ivaPerUnit = totalWithIvaPerUnit * (IVA_RATE / (1 + IVA_RATE));
        costPerUnitBase = totalWithIvaPerUnit * (1 / (1 + IVA_RATE));
    } else {
        costPerUnitBase = basePrice / totalUnits;
        ivaPerUnit = costPerUnitBase * IVA_RATE;
    }

    const transportPerBox = totalBoxesInFreight > 0 ? transportCost / totalBoxesInFreight : 0;
    const transportPerUnit = productsPerBox > 0 ? transportPerBox / productsPerBox : 0;

    const costBaseConFlete = costPerUnitBase + transportPerUnit;
    // ILA sobre neto + flete
    const taxPerUnit = costBaseConFlete * taxRate;
    // Costo + ILA sin IVA: base + flete + ILA solamente
    const totalCostPerUnit = costBaseConFlete + taxPerUnit;

    const sale30 = totalCostPerUnit * 1.30;
    const sale35 = totalCostPerUnit * 1.35;
    const sale40 = totalCostPerUnit * 1.40;

    // Solo lo necesario en el lado derecho (costos con decimales)
    animateValue('totalUnits', totalUnits, false);
    animateValue('costPerUnitDetail', costBaseConFlete);
    animateValue('costPerUnitTotal', totalCostPerUnit);

    // Ventas sin decimales, terminación 00/50/90 al más cercano.
    // Si chocan, se baja el menor. Se muestra el % real resultante.
    const tiers = [
        { rowId: 'row30', priceId: 'sale30', realId: 'sale30real', swapId: 'swap30', margin: 30, exact: sale30 },
        { rowId: 'row35', priceId: 'sale35', realId: 'sale35real', swapId: 'swap35', margin: 35, exact: sale35 },
        { rowId: 'row40', priceId: 'sale40', realId: 'sale40real', swapId: 'swap40', margin: 40, exact: sale40 }
    ];
    if (marginPercentage > 0) {
        tiers.push({ rowId: 'customMarginRow', priceId: 'saleCustom', realId: 'saleCustomReal', swapId: 'swapCustom', margin: marginPercentage, exact: totalCostPerUnit * (1 + marginPercentage / 100) });
    }
    const byDesc = [...tiers].sort((a, b) => b.exact - a.exact);
    let nextRounded = Infinity;
    for (const t of byDesc) {
        let r = commercialRoundNearest(t.exact);
        let guard = 0;
        while (r >= nextRounded && guard++ < 20) {
            r = prevCommercial(nextRounded);
            if (r <= 0) { r = 0; break; }
        }
        t.rounded = r;
        nextRounded = r;
    }
    for (const t of tiers) {
        setSalePrice(t, t.rounded, totalCostPerUnit);
    }

    const customRow = document.getElementById('customMarginRow');
    if (marginPercentage > 0) {
        if (customRow) customRow.style.display = 'flex';
        document.getElementById('lblCustomMargin').textContent = `Margen ${marginPercentage}%`;
    } else {
        if (customRow) customRow.style.display = 'none';
    }
}

function resetResults() {
    updateUnitLabels();
    const elements = [
        'costPerUnitDetail', 'costPerUnitTotal'
    ];

    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = '$0,00';
            currentValues[id] = '$0,00';
        }
    });

    ['sale30', 'sale35', 'sale40', 'saleCustom'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = '$0';
            currentValues[id] = '$0';
        }
    });
    ['sale30real', 'sale35real', 'sale40real', 'saleCustomReal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '';
    });
    ['tip30', 'tip35', 'tip40', 'tipCustom', 'swap30', 'swap35', 'swap40', 'swapCustom'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
    ['row30', 'row35', 'row40', 'customMarginRow'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.setProperty('--cost-pct', '100%');
    });

    const countElements = ['totalUnits'];
    countElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = '0';
            currentValues[id] = '0';
        }
    });

    const customRow = document.getElementById('customMarginRow');
    if (customRow) customRow.style.display = 'none';
}

function formatCLP(value) {
    return '$' + value.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCLPInt(value) {
    return '$' + Math.round(value).toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

function formatPct1(value) {
    return value.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '% real';
}

// Precios comerciales: terminaciones 00 / 50 / 90.
// >= 100: sobre centenas (…00, …50, …90). < 100: sobre unidades (…0, …5, …9).
function commercialCandidates(n) {
    n = Math.round(n);
    if (n < 100) {
        const base = Math.floor(n / 10) * 10;
        return [base - 10, base, base + 5, base + 9, base + 10].filter(v => v >= 0);
    }
    const base = Math.floor(n / 100) * 100;
    return [base - 100, base - 50, base - 10, base, base + 50, base + 90, base + 100].filter(v => v >= 0);
}

function commercialRoundNearest(exact) {
    const n = Math.round(exact);
    const cands = commercialCandidates(n);
    let best = cands[0];
    let bestDist = Math.abs(n - best);
    for (const c of cands) {
        const d = Math.abs(n - c);
        if (d < bestDist || (d === bestDist && c > best)) {
            best = c;
            bestDist = d;
        }
    }
    return best;
}

function prevCommercial(below) {
    const cands = commercialCandidates(Math.round(below) - 1);
    const valid = cands.filter(v => v < below);
    return valid.length ? Math.max(...valid) : 0;
}

function setSalePrice(tier, rounded, costBase) {
    const el = document.getElementById(tier.priceId);
    if (el) {
        const txt = formatCLPInt(rounded);
        el.classList.remove('animating');
        void el.offsetWidth;
        el.classList.add('animating');
        el.textContent = txt;
        currentValues[tier.priceId] = txt;
        setTimeout(() => el.classList.remove('animating'), 300);
    }
    const realEl = document.getElementById(tier.realId);
    if (realEl && costBase > 0) {
        realEl.textContent = formatPct1((rounded - costBase) / costBase * 100);
    } else if (realEl) {
        realEl.textContent = '';
    }
    const row = document.getElementById(tier.rowId);
    if (row && rounded > 0) {
        const costPct = Math.max(0, Math.min(100, costBase / rounded * 100));
        row.style.setProperty('--cost-pct', costPct.toFixed(1) + '%');
    }
    const tip = document.getElementById(tier.swapId);
    if (tip) {
        const gain = rounded - costBase;
        tip.innerHTML = `<span class="swap-cost">Costo ${formatCLP(costBase)}</span><span class="swap-profit">Ganancia ${formatCLP(gain)}</span>`;
    }
}

// Add input validation visual feedback
inputs.forEach(input => {
    if (input.type === 'number') {
        input.addEventListener('input', function() {
            const value = parseFloat(this.value);
            const min = parseFloat(this.min);

            if (this.value && min !== undefined && value < min) {
                this.style.borderColor = '#dc2626';
                this.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)';
            } else if (this.value && this.max !== undefined && value > parseFloat(this.max)) {
                this.style.borderColor = '#f59e0b';
                this.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.1)';
            } else {
                this.style.borderColor = '';
                this.style.boxShadow = '';
            }
        });
    }
});

// Keyboard navigation enhancement
document.addEventListener('keydown', (e) => {
    // Enter to move to next input
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        const inputs = Array.from(form.querySelectorAll('input, select'));
        const currentIndex = inputs.indexOf(e.target);
        if (currentIndex < inputs.length - 1) {
            e.preventDefault();
            inputs[currentIndex + 1].focus();
        }
    }
});

// Carrusel Datos <-> Resultados (solo visible en vertical <=1024px)
(function initCarousel() {
    const main = document.querySelector('main');
    const prev = document.getElementById('carouselPrev');
    const next = document.getElementById('carouselNext');
    const dotDatos = document.getElementById('dotDatos');
    const dotResultados = document.getElementById('dotResultados');
    if (!main || !prev || !next) return;

    const panels = () => Array.from(main.querySelectorAll(':scope > .card, :scope > .results-wrapper'));

    function currentIndex() {
        const list = panels();
        if (!list.length) return 0;
        const x = main.scrollLeft + main.clientWidth / 2;
        let best = 0;
        let bestDist = Infinity;
        list.forEach((p, i) => {
            const cx = p.offsetLeft + p.offsetWidth / 2;
            const d = Math.abs(cx - x);
            if (d < bestDist) { bestDist = d; best = i; }
        });
        return best;
    }

    function goTo(i) {
        const list = panels();
        if (!list.length) return;
        i = Math.max(0, Math.min(list.length - 1, i));
        main.scrollTo({ left: list[i].offsetLeft - main.offsetLeft, behavior: 'smooth' });
    }

    function sync() {
        const i = currentIndex();
        const last = panels().length - 1;
        if (dotDatos) dotDatos.classList.toggle('active', i === 0);
        if (dotResultados) dotResultados.classList.toggle('active', i === last);
        prev.disabled = i === 0;
        next.disabled = i === last;
    }

    prev.addEventListener('click', () => goTo(currentIndex() - 1));
    next.addEventListener('click', () => goTo(currentIndex() + 1));
    main.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    window.addEventListener('resize', sync);
    sync();
})();

// Add ripple effect to buttons
document.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s linear;
            pointer-events: none;
        `;

        this.style.position = 'relative';
        this.style.overflow = 'hidden';
        this.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    });
});

// Add ripple animation keyframe
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
