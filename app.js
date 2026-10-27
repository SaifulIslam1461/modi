// --- Initial Sample Data (Grocery Products) ---
const sampleProducts = [
    { id: 1, name: "আলু (Potato)", price: 45, unitOptions: ["kg", "gm"] },
    { id: 2, name: "দেশি পেঁয়াজ", price: 85, unitOptions: ["kg", "gm"] },
    { id: 3, name: "মিনিক্যাট চাল", price: 72, unitOptions: ["kg", "gm", "bag"] },
    { id: 4, name: "মসুর ডাল", price: 130, unitOptions: ["kg", "gm"] },
    { id: 5, name: "অলিম্পিক বিস্কুট", price: 10, unitOptions: ["pcs"] },
    { id: 6, name: "সয়াবিন তেল (১ লিটার)", price: 165, unitOptions: ["pcs", "litre"] },
    { id: 7, name: "চিনি (Sugar)", price: 125, unitOptions: ["kg", "gm"] },
    { id: 8, name: "প্যাকেট লবণ", price: 40, unitOptions: ["pcs", "kg"] }
];

// --- Application State ---
let draftInvoices = [];
let activeDraftId = null;
let invoiceCounter = 1001;

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
    renderProductCatalog(sampleProducts);
    addNewDraftInvoice(); // Open default first invoice
});

// Sidebar Toggle for Mobile View
function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
}

// Switch Sections/Tabs
function switchTab(tabId, element) {
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(nav => nav.classList.remove("active"));
    
    document.getElementById(tabId).classList.add("active");
    element.classList.add("active");

    // Auto close sidebar on mobile choice
    if (window.innerWidth <= 768) {
        document.getElementById("sidebar").classList.remove("open");
    }
}

// Render Products Grid
function renderProductCatalog(products) {
    const grid = document.getElementById("productsGrid");
    grid.innerHTML = "";

    products.forEach(p => {
        const card = document.createElement("div");
        card.className = "product-item";
        card.onclick = () => addProductToActiveInvoice(p);
        card.innerHTML = `
            <h4>${p.name}</h4>
            <p>৳ ${p.price}</p>
        `;
        grid.appendChild(card);
    });
}

// Filter Products via Search
function filterProducts() {
    const query = document.getElementById("productSearchInput").value.toLowerCase();
    const filtered = sampleProducts.filter(p => p.name.toLowerCase().includes(query));
    renderProductCatalog(filtered);
}

// --- Multiple Draft Invoices Management ---

function addNewDraftInvoice() {
    const newId = `INV-${invoiceCounter++}`;
    const newDraft = {
        id: newId,
        customerName: "",
        customerPhone: "",
        items: [],
        paid: 0
    };

    draftInvoices.push(newDraft);
    setActiveDraft(newId);
}

function setActiveDraft(id) {
    activeDraftId = id;
    renderDraftTabs();
    loadActiveInvoiceData();
}

function renderDraftTabs() {
    const container = document.getElementById("draftTabsContainer");
    container.innerHTML = "";

    draftInvoices.forEach((draft, index) => {
        const tab = document.createElement("div");
        tab.className = `draft-tab ${draft.id === activeDraftId ? 'active' : ''}`;
        
        const label = draft.customerName ? `${draft.customerName}` : `কাস্টমার ${index + 1}`;
        
        tab.innerHTML = `
            <span onclick="setActiveDraft('${draft.id}')"><i class="fa-solid fa-receipt"></i> ${label}</span>
            <span class="close-tab" onclick="closeDraftTab(event, '${draft.id}')">&times;</span>
        `;
        container.appendChild(tab);
    });
}

function closeDraftTab(event, id) {
    event.stopPropagation();
    if (draftInvoices.length === 1) {
        alert("কমপক্ষে একটি চালান রাখা আবশ্যক!");
        return;
    }

    draftInvoices = draftInvoices.filter(d => d.id !== id);
    if (activeDraftId === id) {
        activeDraftId = draftInvoices[0].id;
    }
    renderDraftTabs();
    loadActiveInvoiceData();
}

function deleteCurrentDraft() {
    if (confirm("আপনি কি নিশ্চিত যে বর্তমান ড্রাফট চালানটি মুছে ফেলতে চান?")) {
        closeDraftTab(new Event('click'), activeDraftId);
    }
}

// --- Active Invoice Logic ---

function getActiveDraft() {
    return draftInvoices.find(d => d.id === activeDraftId);
}

function loadActiveInvoiceData() {
    const draft = getActiveDraft();
    if (!draft) return;

    document.getElementById("activeInvoiceNo").innerText = `চালান #${draft.id}`;
    document.getElementById("custName").value = draft.customerName;
    document.getElementById("custPhone").value = draft.customerPhone;
    document.getElementById("paidAmount").value = draft.paid;

    renderInvoiceItems();
}

function updateCustomerDetails() {
    const draft = getActiveDraft();
    if (draft) {
        draft.customerName = document.getElementById("custName").value;
        draft.customerPhone = document.getElementById("custPhone").value;
        renderDraftTabs(); // Update tab name in real-time
    }
}

function addProductToActiveInvoice(product) {
    const draft = getActiveDraft();
    if (!draft) return;

    const existingIndex = draft.items.findIndex(item => item.id === product.id);

    if (existingIndex > -1) {
        draft.items[existingIndex].qty += 1;
    } else {
        draft.items.push({
            id: product.id,
            name: product.name,
            price: product.price,
            qty: 1,
            unit: product.unitOptions[0],
            unitOptions: product.unitOptions
        });
    }

    renderInvoiceItems();
}

function renderInvoiceItems() {
    const draft = getActiveDraft();
    const tbody = document.getElementById("invoiceItemsTable");
    tbody.innerHTML = "";

    if (!draft || draft.items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94A3B8;">কোনো পণ্য যোগ করা হয়নি</td></tr>`;
        calculateTotals();
        return;
    }

    draft.items.forEach((item, idx) => {
        const tr = document.createElement("tr");

        // Calculate item total based on unit
        let itemTotal = item.price * item.qty;
        if (item.unit === "gm") {
            itemTotal = (item.price / 1000) * item.qty; // price per kg converted to grams
        }

        tr.innerHTML = `
            <td>${item.name}</td>
            <td>৳${item.price}</td>
            <td>
                <input type="number" min="0.1" step="any" value="${item.qty}" class="qty-input" onchange="updateItemQty(${idx}, this.value)">
            </td>
            <td>
                <select class="unit-select" onchange="updateItemUnit(${idx}, this.value)">
                    ${item.unitOptions.map(u => `<option value="${u}" ${u === item.unit ? 'selected' : ''}>${u}</option>`).join('')}
                </select>
            </td>
            <td>৳${itemTotal.toFixed(2)}</td>
            <td>
                <i class="fa-solid fa-xmark" style="color:var(--danger-color); cursor:pointer;" onclick="removeItem(${idx})"></i>
            </td>
        `;
        tbody.appendChild(tr);
    });

    calculateTotals();
}

function updateItemQty(index, value) {
    const draft = getActiveDraft();
    const qty = parseFloat(value);
    if (draft && !isNaN(qty) && qty > 0) {
        draft.items[index].qty = qty;
        renderInvoiceItems();
    }
}

function updateItemUnit(index, unit) {
    const draft = getActiveDraft();
    if (draft) {
        draft.items[index].unit = unit;
        renderInvoiceItems();
    }
}

function removeItem(index) {
    const draft = getActiveDraft();
    if (draft) {
        draft.items.splice(index, 1);
        renderInvoiceItems();
    }
}

function calculateTotals() {
    const draft = getActiveDraft();
    if (!draft) return;

    let subtotal = 0;
    draft.items.forEach(item => {
        if (item.unit === "gm") {
            subtotal += (item.price / 1000) * item.qty;
        } else {
            subtotal += item.price * item.qty;
        }
    });

    const paid = parseFloat(document.getElementById("paidAmount").value) || 0;
    draft.paid = paid;

    const due = subtotal - paid;

    document.getElementById("subTotal").innerText = subtotal.toFixed(2);
    document.getElementById("dueAmount").innerText = due > 0 ? due.toFixed(2) : "0.00";
}

// Fake Complete Sale Notification
function confirmSale() {
    const draft = getActiveDraft();
    if (!draft || draft.items.length === 0) {
        alert("চালানে কোনো পণ্য নেই!");
        return;
    }

    alert(`[নমুনা ইন্টারঅ্যাকশন] ${draft.id} নম্বর চালানটি সফলভাবে নিশ্চিত করা হয়েছে!\n\n(দ্রষ্টব্য: পরবর্তী ধাপে IndexedDB ডাটাবেজ যুক্ত হলে প্রকৃত স্টক কমবে ও চালানটি স্থায়ীভাবে সেভ হবে)`);
    
    // Close current draft upon sale
    closeDraftTab(new Event('click'), activeDraftId);
}

// Print / PDF Modal Logic
function openPrintPreview() {
    const draft = getActiveDraft();
    if (!draft || draft.items.length === 0) {
        alert("প্রিন্ট দেখার জন্য চালানে অন্তত একটি পণ্য যোগ করুন!");
        return;
    }

    document.getElementById("printInvoiceNo").innerText = draft.id;
    document.getElementById("printDate").innerText = new Date().toLocaleDateString('bn-BD');
    document.getElementById("printCustName").innerText = draft.customerName || "সাধারণ কাস্টমার";
    document.getElementById("printCustPhone").innerText = draft.customerPhone || "N/A";

    const printTbody = document.getElementById("printTableBody");
    printTbody.innerHTML = "";

    let total = 0;
    draft.items.forEach((item, index) => {
        let itemTotal = item.price * item.qty;
        if (item.unit === "gm") itemTotal = (item.price / 1000) * item.qty;
        total += itemTotal;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.name}</td>
            <td>${item.qty} ${item.unit}</td>
            <td>৳${item.price}</td>
            <td>৳${itemTotal.toFixed(2)}</td>
        `;
        printTbody.appendChild(tr);
    });

    const due = total - draft.paid;

    document.getElementById("printSubtotal").innerText = total.toFixed(2);
    document.getElementById("printPaid").innerText = draft.paid.toFixed(2);
    document.getElementById("printDue").innerText = due > 0 ? due.toFixed(2) : "0.00";

    document.getElementById("printModal").style.display = "flex";
}

function closePrintPreview() {
    document.getElementById("printModal").style.display = "none";
}

function triggerPrint() {
    window.print();
}
