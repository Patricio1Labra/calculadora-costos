const IVA_RATE = 0.19;

const TAX_RATES = {
    none: 0,
    analcoholicas: 0.10,
    alto_azucar: 0.18,
    vinos_cervezas: 0.205,
    licores: 0.315,
    carne: 0.042,
    custom: null
};

const TAX_LABELS = {
    none: '',
    analcoholicas: 'Bebidas analcohólicas (10%)',
    alto_azucar: 'Bebidas altas en azúcar (18%)',
    vinos_cervezas: 'Vinos/Cervezas (20,5%)',
    licores: 'Licores/Destilados (31,5%)',
    carne: 'Carne (4,2%)',
    custom: 'Impuesto personalizado'
};

const form = document.getElementById('calculatorForm');
const taxType = document.getElementById('taxType');
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
    });

    input.addEventListener('blur', function() {
        this.parentElement.classList.remove('focused');
    });
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
    document.getElementById('productsPerBox').focus();
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

    // Update value
    element.textContent = targetText;

    // Remove animation class after it completes
    setTimeout(() => {
        element.classList.remove('animating');
    }, 300);

    currentValues[elementId] = targetText;
}

function calculate() {
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

    let costPerBox, ivaPerUnit;

    if (priceIncludesIva) {
        costPerBox = basePrice;
        ivaPerUnit = (basePrice / productsPerBox) * (IVA_RATE / (1 + IVA_RATE));
    } else {
        costPerBox = basePrice * (1 + IVA_RATE);
        ivaPerUnit = (basePrice / productsPerBox) * IVA_RATE;
    }

    const costPerUnitBase = priceIncludesIva
        ? (basePrice / productsPerBox) * (1 / (1 + IVA_RATE))
        : basePrice / productsPerBox;

    const costWithoutIva = costPerUnitBase;
    const taxPerUnit = costWithoutIva * taxRate;
    const transportPerBox = totalBoxesInFreight > 0 ? transportCost / totalBoxesInFreight : 0;
    const transportPerUnit = productsPerBox > 0 ? transportPerBox / productsPerBox : 0;

    const totalCostPerUnit = costPerUnitBase + ivaPerUnit + taxPerUnit + transportPerUnit;
    const profitPerUnit = totalCostPerUnit * (marginPercentage / 100);
    const salePricePerUnit = totalCostPerUnit + profitPerUnit;

    const totalSaleValue = salePricePerUnit * totalUnits;
    const totalCostValue = totalCostPerUnit * totalUnits;
    const totalProfit = totalSaleValue - totalCostValue;

    // Animate summary values
    animateValue('costPerUnit', totalCostPerUnit);
    animateValue('salePricePerUnit', salePricePerUnit);
    animateValue('totalUnits', totalUnits, false);
    animateValue('profitPerUnit', profitPerUnit);

    // Animate detail values
    animateValue('costPerBox', costPerBox);
    animateValue('costPerUnitDetail', costPerUnitBase);
    animateValue('ivaPerUnit', ivaPerUnit);

    const taxRow = document.getElementById('taxRow');
    if (taxTypeValue !== 'none' && taxRate > 0) {
        taxRow.style.display = 'table-row';
        document.getElementById('taxLabel').textContent = TAX_LABELS[taxTypeValue] + ' / unidad';
        animateValue('taxPerUnit', taxPerUnit);
    } else {
        taxRow.style.display = 'none';
    }

    animateValue('transportPerUnit', transportPerUnit);
    animateValue('costPerUnitTotal', totalCostPerUnit);
    animateValue('totalUnitsSummary', totalUnits, false);
    animateValue('salePriceSummary', salePricePerUnit);
    animateValue('totalSaleValue', totalSaleValue);
    animateValue('totalCostValue', totalCostValue);
    animateValue('totalProfit', totalProfit);

    // Update profit color based on positive/negative
    const profitElement = document.getElementById('profitPerUnit');
    const totalProfitElement = document.getElementById('totalProfit');

    if (profitPerUnit < 0) {
        profitElement.style.color = '#dc2626';
        totalProfitElement.style.color = '#dc2626';
    } else {
        profitElement.style.color = '';
        totalProfitElement.style.color = '';
    }
}

function resetResults() {
    const elements = [
        'costPerUnit', 'salePricePerUnit', 'profitPerUnit',
        'costPerBox', 'costPerUnitDetail', 'ivaPerUnit',
        'transportPerUnit', 'salePriceSummary', 'totalCostValue'
    ];

    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = '$0,00';
            currentValues[id] = '$0,00';
        }
    });

    const countElements = ['totalUnits', 'totalUnitsSummary'];
    countElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = '0';
            currentValues[id] = '0';
        }
    });

    document.getElementById('taxRow').style.display = 'none';

    const boldElements = ['costPerUnitTotal', 'totalSaleValue', 'totalProfit'];
    boldElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = '<strong>$0,00</strong>';
            currentValues[id] = '$0,00';
        }
    });
}

function formatCLP(value) {
    return '$' + value.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
