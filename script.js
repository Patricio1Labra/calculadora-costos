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
    gramos: { singular: 'Gramo', plural: 'Gramos', lower: 'gramo' }
};

function getUnitLabels() {
    const unitType = (document.getElementById('unitType') || {}).value || 'unidades';
    return UNIT_LABELS[unitType] || UNIT_LABELS.unidades;
}

// Modo gramaje: la unidad es gramos. Los productos por peso nunca
// vienen en cajas con cantidad uniforme, así que las unidades siempre
// se obtienen como pesoTotal / gramajePorUnidad
// (ej. factura por kilos con productos de 100/200/280 g).
function isGramajeCalcActive() {
    const ut = (document.getElementById('unitType') || {}).value || 'unidades';
    return ut === 'gramos';
}

// En gramos las cajas no son uniformes (ej. una de 48,01 y otra de
// 47,9): la cantidad de cajas solo sirve para el flete.
// Se oculta la fila de cajas del producto; las cajas del flete
// quedan siempre visibles.
function syncGramajeUI() {
    const active = isGramajeCalcActive();
    const inputsRow = document.getElementById('gramajeInputsRow');
    if (inputsRow) inputsRow.style.display = active ? '' : 'none';
    const rowBoxes = document.getElementById('rowBoxes');
    if (rowBoxes) rowBoxes.style.display = active ? 'none' : '';
}

function updateUnitLabels() {
    const weightMode = isGramajeCalcActive();
    const u = weightMode ? UNIT_LABELS.unidades : getUnitLabels();
    const customMargin = parseFloat((document.getElementById('marginPercentage') || {}).value) || 0;
    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    set('lblTotalUnits', weightMode ? 'Total Unidades' : `Total ${u.plural}`);
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

// Los inputs numéricos usan type="text" + inputmode="decimal":
// type="number" no soporta la Selection API en Chromium
// (.select() no hace nada), así que seleccionar-con-un-clic
// solo funciona con inputs de texto. inputmode="decimal"
// mantiene el teclado numérico en móvil.
// Acepta coma decimal chilena ("15000,5" -> 15000.5).
function parseNumber(value) {
    if (typeof value === 'number') return value || 0;
    if (typeof value !== 'string') return 0;
    return parseFloat(value.replace(',', '.')) || 0;
}

function selectAllText(el) {
    if (!el || el.tagName !== 'INPUT' || !el.value) return;
    try {
        el.select();
    } catch (_) {
        try {
            el.setSelectionRange(0, el.value.length);
        } catch (_2) {
            /* input no seleccionable: no hacer nada */
        }
    }
}

// Recuerda si el input ya tenía foco al presionar el botón del mouse:
// - primer clic (sin foco previo): selecciona todo el texto
// - clics siguientes (ya enfocado): posicionan el cursor normalmente
const mouseDownHadFocus = new WeakMap();

inputs.forEach(input => {
    input.addEventListener('input', calculate);
    input.addEventListener('change', calculate);

    input.addEventListener('mousedown', function() {
        mouseDownHadFocus.set(this, document.activeElement === this);
    });

    // Add focus animations
    input.addEventListener('focus', function() {
        this.parentElement.classList.add('focused');
        // Seleccionar todo el texto solo si el foco es nuevo
        // (teclado/Tab o primer clic); si ya tenía foco, no molestar.
        if (this.tagName === 'INPUT' && !mouseDownHadFocus.get(this)) {
            selectAllText(this);
        }
    });

    input.addEventListener('blur', function() {
        this.parentElement.classList.remove('focused');
        mouseDownHadFocus.delete(this);
    });

    // Evita que el mouseup del primer clic deseleccione lo que
    // se seleccionó en focus (comportamiento estándar en desktop).
    if (input.tagName === 'INPUT') {
        input.addEventListener('mouseup', function(e) {
            if (!mouseDownHadFocus.get(this) && this.value) {
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

// Impuesto adicional como botonera: los botones escriben en el
// select oculto #taxType para reutilizar su lógica (change/calculate).
const taxButtons = Array.from(document.querySelectorAll('#taxButtons .tax-btn'));

const taxCurrentEmoji = document.getElementById('taxCurrentEmoji');
const taxCurrentName = document.getElementById('taxCurrentName');
const taxCurrentDesc = document.getElementById('taxCurrentDesc');
const taxCurrentRate = document.getElementById('taxCurrentRate');

function syncTaxButtons() {
    const current = taxButtons.find(btn => btn.dataset.tax === taxType.value) || taxButtons[0];
    taxButtons.forEach(btn => {
        const active = btn === current;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-checked', active ? 'true' : 'false');
        btn.style.gridColumn = '';
        btn.style.gridRow = '';
    });
    // Tarjeta superior con el detalle (los tiles no cambian de tamaño,
    // así el orden se mantiene siempre).
    if (taxCurrentEmoji) taxCurrentEmoji.textContent = current.querySelector('.tax-btn-emoji').textContent;
    if (taxCurrentName) taxCurrentName.textContent = current.querySelector('.tax-btn-name').textContent;
    if (taxCurrentDesc) taxCurrentDesc.textContent = current.dataset.tip || '';
    if (taxCurrentRate) {
        const rate = current.querySelector('.tax-btn-rate').textContent.trim();
        taxCurrentRate.textContent = rate;
        taxCurrentRate.style.display = rate ? '' : 'none';
    }
}

taxButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        if (taxType.value !== btn.dataset.tax) {
            taxType.value = btn.dataset.tax;
            taxType.dispatchEvent(new Event('change', { bubbles: true }));
        }
        syncTaxButtons();
    });

    // Posiciona el tooltip para que la card (overflow hidden) no lo recorte
    const placeTip = () => {
        btn.classList.remove('tip-left', 'tip-right');
        const card = btn.closest('.card');
        if (!card) return;
        const c = card.getBoundingClientRect();
        const r = btn.getBoundingClientRect();
        const half = 120; // ~mitad del max-width del tooltip
        if (r.left - half < c.left) btn.classList.add('tip-left');
        else if (r.right + half > c.right) btn.classList.add('tip-right');
    };
    btn.addEventListener('mouseenter', placeTip);
    btn.addEventListener('focus', placeTip);
});

syncTaxButtons();

if (unitType) {
    unitType.addEventListener('change', () => {
        syncGramajeUI();
        updateUnitLabels();
        calculate();
    });
}

syncGramajeUI();

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
    syncTaxButtons();
    syncGramajeUI();
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
    const productsPerBox = parseNumber(document.getElementById('productsPerBox').value);
    const totalBoxes = parseNumber(document.getElementById('totalBoxes').value);
    const basePrice = parseNumber(document.getElementById('basePrice').value);
    const priceTaxMode = (document.getElementById('priceIncludesTax') || {}).value || 'no';
    const taxTypeValue = taxType.value;
    const customTaxPercent = parseNumber(document.getElementById('customTaxPercent').value);
    const transportCost = parseNumber(document.getElementById('transportCost').value);
    const totalBoxesInFreight = parseNumber(document.getElementById('totalBoxesInFreight').value) || 1;
    const marginPercentage = parseNumber(document.getElementById('marginPercentage').value);
    const weightMode = isGramajeCalcActive();
    let totalUnits;

    if (weightMode) {
        const pesoTotal = parseNumber(document.getElementById('pesoTotalGramos').value);
        const gramajeUnidad = parseNumber(document.getElementById('gramajePorUnidad').value);
        if (pesoTotal <= 0 || gramajeUnidad <= 0 || basePrice <= 0) {
            resetResults();
            return;
        }
        totalUnits = pesoTotal / gramajeUnidad;
    } else {
        if (productsPerBox <= 0 || totalBoxes <= 0 || basePrice <= 0) {
            resetResults();
            return;
        }
        totalUnits = productsPerBox * totalBoxes;
    }

    let taxRate = TAX_RATES[taxTypeValue];
    if (taxTypeValue === 'custom') {
        taxRate = customTaxPercent / 100;
    }

    // El precio base es el TOTAL (neto o con impuestos incluidos) por
    // todas las unidades: productosPorCaja * totalCajas
    // (o pesoTotal / gramajePorUnidad en modo gramaje).
    // Si el precio ya trae impuestos, se extrae el neto:
    // - iva: bruto = neto * (1 + IVA)
    // - ila: bruto = neto * (1 + ILA) [tasa del impuesto elegido]
    // - both: bruto = neto * (1 + IVA + ILA) [misma base imponible]
    // Con impuesto "Ninguno" (tasa 0), ila/both equivalen a no/iva.
    const grossPerUnit = basePrice / totalUnits;
    let ivaPerUnit;
    let costPerUnitBase;

    if (priceTaxMode === 'iva' || priceTaxMode === 'both') {
        const divisor = 1 + IVA_RATE + (priceTaxMode === 'both' ? taxRate : 0);
        costPerUnitBase = grossPerUnit / divisor;
        ivaPerUnit = costPerUnitBase * IVA_RATE;
    } else if (priceTaxMode === 'ila') {
        costPerUnitBase = grossPerUnit / (1 + taxRate);
        ivaPerUnit = costPerUnitBase * IVA_RATE;
    } else {
        costPerUnitBase = grossPerUnit;
        ivaPerUnit = costPerUnitBase * IVA_RATE;
    }

    let transportPerUnit;
    if (weightMode) {
        // Sin cajas uniformes: el flete se reparte entre las unidades
        transportPerUnit = totalUnits > 0 ? transportCost / totalUnits : 0;
    } else {
        const transportPerBox = totalBoxesInFreight > 0 ? transportCost / totalBoxesInFreight : 0;
        transportPerUnit = productsPerBox > 0 ? transportPerBox / productsPerBox : 0;
    }

    const costBaseConFlete = costPerUnitBase + transportPerUnit;
    // ILA sobre neto + flete (se muestra como "Costo + ILA")
    const taxPerUnit = costBaseConFlete * taxRate;
    // Costo + ILA sin IVA: base + flete + ILA solamente
    const totalCostPerUnit = costBaseConFlete + taxPerUnit;
    // Base para los márgenes: costo total con impuestos incluidos
    // (misma base imponible: neto + flete, + ILA + IVA 19%).
    const ivaCostPerUnit = costBaseConFlete * IVA_RATE;
    const costoMargen = totalCostPerUnit + ivaCostPerUnit;

    const sale30 = costoMargen * 1.30;
    const sale35 = costoMargen * 1.35;
    const sale40 = costoMargen * 1.40;

    // Solo lo necesario en el lado derecho (costos con decimales)
    animateValue('totalUnits', totalUnits, false);
    animateValue('costPerUnitDetail', costBaseConFlete);
    animateValue('costPerUnitTotal', totalCostPerUnit);

    // Ventas sin decimales, terminación 00/50/90 al más cercano.
    // Los precios deben ser distintos y crecientes con el margen, y cada
    // nivel se queda con el más cercano a su objetivo (el que está más
    // cerca del precio redondeado tiene prioridad sobre él).
    // Se muestra el % real resultante.
    const tiers = [
        { rowId: 'row30', priceId: 'sale30', realId: 'sale30real', swapId: 'swap30', margin: 30, exact: sale30 },
        { rowId: 'row35', priceId: 'sale35', realId: 'sale35real', swapId: 'swap35', margin: 35, exact: sale35 },
        { rowId: 'row40', priceId: 'sale40', realId: 'sale40real', swapId: 'swap40', margin: 40, exact: sale40 }
    ];
    if (!assignRoundedPrices(tiers)) {
        // Resguardo: voraz desde el mayor hacia abajo
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
    }
    if (marginPercentage > 0) {
        // Margen personalizado: valor exacto, sin aproximación comercial
        const customExact = costoMargen * (1 + marginPercentage / 100);
        tiers.push({ rowId: 'customMarginRow', priceId: 'saleCustom', realId: 'saleCustomReal', swapId: 'swapCustom', margin: marginPercentage, exact: customExact, rounded: customExact, noRound: true });
    }
    for (const t of tiers) {
        setSalePrice(t, t.rounded, costoMargen);
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

function nextCommercial(above) {
    const cands = commercialCandidates(Math.round(above) + 1);
    const valid = cands.filter(v => v > above);
    return valid.length ? Math.min(...valid) : Math.round(above) + 1;
}

// Candidatos comerciales alrededor del objetivo (el más cercano
// más 3 escalones hacia abajo y hacia arriba).
function tierCandidates(exact, steps = 3) {
    const set = new Set([commercialRoundNearest(exact)]);
    let down = commercialRoundNearest(exact);
    for (let i = 0; i < steps; i++) {
        down = prevCommercial(down);
        if (down <= 0) break;
        set.add(down);
    }
    let up = commercialRoundNearest(exact);
    for (let i = 0; i < steps; i++) {
        const nx = nextCommercial(up);
        if (nx <= up) break;
        up = nx;
        set.add(up);
    }
    return [...set].sort((a, b) => a - b);
}

// Asigna a cada nivel un precio comercial distinto y creciente con el
// margen, minimizando el error relativo total: el nivel más cercano
// a un precio redondeado tiene prioridad sobre él.
function assignRoundedPrices(tiers) {
    const ordered = [...tiers].sort((a, b) => a.exact - b.exact);
    const cands = ordered.map(t => tierCandidates(t.exact));
    const n = ordered.length;
    const picks = new Array(n);
    let best = null;
    function dfs(i, minAbove, err) {
        if (best && err >= best.err) return;
        if (i === n) {
            best = { err, picks: [...picks] };
            return;
        }
        for (const c of cands[i]) {
            if (c <= minAbove || c <= 0) continue;
            picks[i] = c;
            dfs(i + 1, c, err + Math.abs(c - ordered[i].exact) / ordered[i].exact);
        }
    }
    dfs(0, -Infinity, 0);
    if (!best) return false;
    ordered.forEach((t, i) => { t.rounded = best.picks[i]; });
    return true;
}

function setSalePrice(tier, rounded, costBase) {
    const el = document.getElementById(tier.priceId);
    if (el) {
        // Personalizado: valor exacto con decimales, sin aproximación
        const txt = tier.noRound ? formatCLP(rounded) : formatCLPInt(rounded);
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
    if (input.type === 'number' || input.inputMode === 'decimal') {
        input.addEventListener('input', function() {
            const value = parseNumber(this.value);
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
    // Enter to move to next input (salta elementos ocultos)
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        const focusables = Array.from(form.querySelectorAll('input, select'))
            .filter(el => el.offsetParent !== null);
        const currentIndex = focusables.indexOf(e.target);
        if (currentIndex >= 0 && currentIndex < focusables.length - 1) {
            e.preventDefault();
            focusables[currentIndex + 1].focus();
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

// Add ripple effect to buttons (la botonera de impuestos se excluye:
// el ripple usa overflow hidden y recortaría sus tooltips)
document.querySelectorAll('button:not(.tax-btn)').forEach(button => {
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
