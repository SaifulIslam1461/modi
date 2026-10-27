// --- IndexedDB Database Configuration ---
const DB_NAME = "SmartDokanDB";
const DB_VERSION = 1;
let db = null;

// Initial Default Products for Seed
const defaultProducts = [
    { name: "আলু (Potato)", costPrice: 38, price: 45, stock: 50, unitOptions: ["kg", "gm"] },
    { name: "দেশি পেঁয়াজ", costPrice: 75, price: 85, stock: 40, unitOptions: ["kg", "gm"] },
    { name: "মিনিক্যাট চাল", costPrice: 65, price: 72, stock: 100, unitOptions: ["kg", "gm", "bag"] },
    { name: "মসুর ডাল", costPrice: 115, price: 130, stock: 30, unitOptions: ["kg", "gm"] },
    { name: "অলিম্পিক বিস্কুট", costPrice: 8, price: 10, stock: 60, unitOptions: ["pcs"] },
    { name: "সয়াবিন তেল (১ লিটার)", costPrice: 150, price: 165, stock: 25, unitOptions: ["pcs", "litre"] }
];

// App State
let productsCache = [];
let draftInvoices = [];
let activeDraftId = null;
let invoiceCounter = 1001;
let shopSettings = { name: "বিসমিল্লাহ্‌ স্টোর", address: "পরশুরাম বাজার, ফেনী", phone: "০১৭১২-০০০০০০" };

// Initialize Database & App
document.addEventListener("DOMContentLoaded", () => {
    initDatabase();
});

function initDatabase() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
        console.error("IndexedDB error:", event.target.error);
        alert("লোকাল ডেটাবেজ খুলতে সমস্যা হয়েছে!");
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        loadAppSettings();
        loadProductsFromDB();
        addNewDraftInvoice();
        refreshDashboardStats();
    };

    request.onupgradeneeded = (event) => {
        const database = event.target.result;
        if (!database.objectStoreNames.contains("products")) {
            database.createObjectStore("products", { keyPath: "id", autoIncrement: true });
        }
        if (!database.objectStoreNames.contains("sales")) {
            database.createObjectStore("sales", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("expenses")) {
            database.createObjectStore("expenses", { keyPath: "id", autoIncrement: true });
        }
        if (!database.objectStoreNames.contains("settings")) {
            database.createObjectStore("settings", { keyPath: "key" });
        }
    };
}

// --- Settings Operations ---
function loadAppSettings() {
    const transaction = db.transaction(["settings"], "readonly");
    const store = transaction.objectStore("settings");
    const request = store.get("shop_info");

    request.onsuccess = () => {
        if (request.result) {
            shopSettings = request.result.data;
        } else {
            saveAppSettingsToDB(); // Save defaults
        }
        applySettingsToUI();
    };
}

function saveAppSettingsToDB() {
    const transaction = db.transaction(["settings"], "readwrite");
    const store = transaction.objectStore("settings");
    store.put({ key: "shop_info", data: shopSettings });
}

function applySettingsToUI() {
    document.getElementById("headerShopName").innerText = shopSettings.name;
    document.getElementById("printShopName").innerText = shopSettings.name;
    document.getElementById("printShopAddress").innerText = shopSettings.address;
    document.getElementById("printShopPhone").innerText = shopSettings.phone;

    document.getElementById("settingShopName").value = shopSettings.name;
    document.getElementById("settingShopAddress").value = shopSettings.address;
    document.getElementById("settingShopPhone").value = shopSettings.phone;
}

function saveSettingsData() {
    shopSettings.name = document.getElementById("settingShopName").value || "Smart Dokan";
    shopSettings.address = document.getElementById("settingShopAddress").value || "";
    shopSettings.phone = document.getElementById("settingShopPhone").value || "";

    saveAppSettingsToDB();
    applySettingsToUI();
    alert("সেটিংস সফলভাবে সংরক্ষিত হয়েছে!");
}

// --- Products CRUD & DB ---
function loadProductsFromDB() {
    const transaction = db.transaction(["products"], "readonly");
    const store = transaction.objectStore("products");
    const request = store.getAll();

    request.onsuccess = () => {
        productsCache = request.result;
        if (productsCache.length === 0) {
            // Seed default products
            seedDefaultProducts();
        } else {
            renderProductCatalog(productsCache);
            renderManageProducts();
        }
    };
}

function seedDefaultProducts() {
    const transaction = db.transaction(["products"], "readwrite");
    const store = transaction.objectStore("products");
    defaultProducts.forEach(p => store.add(p));

    transaction.oncomplete = () => {
        loadProductsFromDB();
    };
}

function renderProductCatalog(products) {
    const grid = document.getElementById("productsCatalogGrid");
    grid.innerHTML = "";

    products.forEach(p => {
        const card = document.createElement("div");
        card.className = "product-item";
        card.onclick = () => addProductToActiveInvoice(p);
        card.innerHTML = `
            <h4>${p.name}</h4>
            <p>৳ ${p.price}</p>
            <small style="font-size:0.7rem; color:#64748B;">স্টক: ${p.stock}</small>
        `;
        grid.appendChild(card);
    });
}

function filterProductsCatalog() {
    const query = document.getElementById("productSearchInput").value.toLowerCase();
    const filtered = productsCache.filter(p => p.name.toLowerCase().includes(query));
    renderProductCatalog(filtered);
}

function renderManageProducts() {
    const tbody = document.getElementById("manageProductsTableBody");
    tbody.innerHTML = "";
    const query = document.getElementById("manageProductSearch") ? document.getElementById("manageProductSearch").value.toLowerCase() : "";

    const filtered = productsCache.filter(p => p.name.toLowerCase().includes(query));

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94A3B8;">কোনো পণ্য পাওয়া যায়নি</td></tr>`;
        return;
    }

    filtered.forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${p.name}</td>
            <td>৳${p.costPrice || 0}</td>
            <td>৳${p.price}</td>
            <td>${p.stock}</td>
            <td>${p.unitOptions ? p.unitOptions.join(', ') : 'kg'}</td>
            <td>
                <button class="btn btn-secondary" style="padding: 2px 6px; font-size:0.75rem;" onclick="editProduct(${p.id})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-outline-danger" style="padding: 2px 6px; font-size:0.75rem;" onclick="deleteProduct(${p.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openProductModal(id = null) {
    document.getElementById("editProductId").value = "";
    document.getElementById("modalProdName").value = "";
    document.getElementById("modalProdCost").value = "";
    document.getElementById("modalProdPrice").value = "";
    document.getElementById("modalProdStock").value = "";
    document.getElementById("modalProdUnits").value = "kg, gm, pcs";
    document.getElementById("productModalTitle").innerText = "নতুন পণ্য যোগ করুন";

    if (id) {
        const prod = productsCache.find(p => p.id === id);
        if (prod) {
            document.getElementById("editProductId").value = prod.id;
            document.getElementById("modalProdName").value = prod.name;
            document.getElementById("modalProdCost").value = prod.costPrice || 0;
            document.getElementById("modalProdPrice").value = prod.price;
            document.getElementById("modalProdStock").value = prod.stock;
            document.getElementById("modalProdUnits").value = prod.unitOptions ? prod.unitOptions.join(', ') : 'kg';
            document.getElementById("productModalTitle").innerText = "পণ্য সম্পাদনা করুন";
        }
    }
    document.getElementById("productModal").style.display = "flex";
}

function closeProductModal() {
    document.getElementById("productModal").style.display = "none";
}

function saveProductData() {
    const id = document.getElementById("editProductId").value;
    const name = document.getElementById("modalProdName").value.trim();
    const costPrice = parseFloat(document.getElementById("modalProdCost").value) || 0;
    const price = parseFloat(document.getElementById("modalProdPrice").value) || 0;
    const stock = parseFloat(document.getElementById("modalProdStock").value) || 0;
    const unitsStr = document.getElementById("modalProdUnits").value;
    const unitOptions = unitsStr.split(',').map(u => u.trim()).filter(u => u);

    if (!name || price <= 0) {
        alert("পণ্যের নাম এবং সঠিক বিক্রয়মূল্য দিন!");
        return;
    }

    const transaction = db.transaction(["products"], "readwrite");
    const store = transaction.objectStore("products");

    const productObj = { name, costPrice, price, stock, unitOptions };
    if (id) {
        productObj.id = parseInt(id);
        store.put(productObj);
    } else {
        store.add(productObj);
    }

    transaction.oncomplete = () => {
        closeProductModal();
        loadProductsFromDB();
    };
}

function editProduct(id) {
    openProductModal(id);
}

function deleteProduct(id) {
    if (confirm("আপনি কি নিশ্চিত যে এই পণ্যটি মুছে ফেলতে চান?")) {
        const transaction = db.transaction(["products"], "readwrite");
        const store = transaction.objectStore("products");
        store.delete(id);
        transaction.oncomplete = () => {
            loadProductsFromDB();
        };
    }
}

// --- Draft Invoices Management ---
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
        const label = draft.customerName ? `${draft.customerName}` : `চালান ${index + 1}`;
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
    if (confirm("বর্তমান ড্রাফট চালানটি বাতিল করতে চান?")) {
        closeDraftTab(new Event('click'), activeDraftId);
    }
}

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
        renderDraftTabs();
    }
}

function addProductToActiveInvoice(product) {
    const draft = getActiveDraft();
    if (!draft) return;

    const existingIndex = draft.items.findIndex(item => item.productId === product.id);

    if (existingIndex > -1) {
        draft.items[existingIndex].qty += 1;
    } else {
        draft.items.push({
            productId: product.id,
            name: product.name,
            price: product.price,
            costPrice: product.costPrice || 0,
            qty: 1,
            unit: product.unitOptions ? product.unitOptions[0] : 'kg',
            unitOptions: product.unitOptions || ['kg']
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
        let itemTotal = item.price * item.qty;
        if (item.unit === "gm") {
            itemTotal = (item.price / 1000) * item.qty;
        }

        tr.innerHTML = `
            <td>${item.name}</td>
            <td>৳${item.price}</td>
            <td><input type="number" min="0.1" step="any" value="${item.qty}" class="qty-input" onchange="updateItemQty(${idx}, this.value)"></td>
            <td>
                <select class="unit-select" onchange="updateItemUnit(${idx}, this.value)">
                    ${item.unitOptions.map(u => `<option value="${u}" ${u === item.unit ? 'selected' : ''}>${u}</option>`).join('')}
                </select>
            </td>
            <td>৳${itemTotal.toFixed(2)}</td>
            <td><i class="fa-solid fa-xmark" style="color:var(--danger-color); cursor:pointer;" onclick="removeItem(${idx})"></i></td>
        `;
        tbody.appendChild(tr);
    });

    calculateTotals();
}

function updateItemQty(index, val) {
    const draft = getActiveDraft();
    const q = parseFloat(val);
    if (draft && !isNaN(q) && q > 0) {
        draft.items[index].qty = q;
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

// --- Confirm Sale & Stock Deduction ---
function confirmSale() {
    const draft = getActiveDraft();
    if (!draft || draft.items.length === 0) {
        alert("চালানে কোনো পণ্য নেই!");
        return;
    }

    let subtotal = 0;
    draft.items.forEach(item => {
        if (item.unit === "gm") subtotal += (item.price / 1000) * item.qty;
        else subtotal += item.price * item.qty;
    });

    const saleRecord = {
        id: draft.id,
        customerName: draft.customerName || "সাধারণ কাস্টমার",
        customerPhone: draft.customerPhone || "N/A",
        items: draft.items,
        subtotal: subtotal,
        paid: draft.paid,
        due: subtotal - draft.paid > 0 ? subtotal - draft.paid : 0,
        date: new Date().toISOString(),
        status: "confirmed"
    };

    const transaction = db.transaction(["sales", "products"], "readwrite");
    const salesStore = transaction.objectStore("sales");
    const prodStore = transaction.objectStore("products");

    salesStore.put(saleRecord);

    // Reduce stock once
    draft.items.forEach(item => {
        const prodReq = prodStore.get(item.productId);
        prodReq.onsuccess = () => {
            const p = prodReq.result;
            if (p) {
                let deductQty = item.qty;
                if (item.unit === "gm") deductQty = item.qty / 1000;
                p.stock = Math.max(0, p.stock - deductQty);
                prodStore.put(p);
            }
        };
    });

    transaction.oncomplete = () => {
        alert(`চালান #${draft.id} সফলভাবে নিশ্চিত ও সংরক্ষিত হয়েছে!`);
        loadProductsFromDB();
        refreshDashboardStats();
        loadAllInvoices();
        loadCustomers();
        closeDraftTab(new Event('click'), activeDraftId);
    };
}

// --- All Invoices & Reports ---
function loadAllInvoices() {
    const transaction = db.transaction(["sales"], "readonly");
    const store = transaction.objectStore("sales");
    const request = store.getAll();

    request.onsuccess = () => {
        const sales = request.result;
        const tbody = document.getElementById("allInvoicesTableBody");
        tbody.innerHTML = "";

        if (sales.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94A3B8;">কোনো চালান সংরক্ষিত নেই</td></tr>`;
            return;
        }

        sales.reverse().forEach(s => {
            const dateStr = new Date(s.date).toLocaleDateString('bn-BD');
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${s.id}</td>
                <td>${dateStr}</td>
                <td>${s.customerName}</td>
                <td>৳${s.subtotal.toFixed(2)}</td>
                <td>৳${s.paid.toFixed(2)}</td>
                <td style="color:var(--danger-color);">৳${s.due.toFixed(2)}</td>
                <td><button class="btn btn-secondary" style="padding:2px 6px; font-size:0.75rem;" onclick="reprintInvoice('${s.id}')"><i class="fa-solid fa-print"></i></button></td>
            `;
            tbody.appendChild(tr);
        });
    };
}

// Customers Due Khata
function loadCustomers() {
    const transaction = db.transaction(["sales"], "readonly");
    const store = transaction.objectStore("sales");
    const request = store.getAll();

    request.onsuccess = () => {
        const sales = request.result;
        const customerMap = {};

        sales.forEach(s => {
            if (s.due > 0 && s.customerName !== "সাধারণ কাস্টমার") {
                if (!customerMap[s.customerName]) {
                    customerMap[s.customerName] = { name: s.customerName, phone: s.customerPhone, due: 0 };
                }
                customerMap[s.customerName].due += s.due;
            }
        });

        const tbody = document.getElementById("customersTableBody");
        tbody.innerHTML = "";
        const customers = Object.values(customerMap);

        if (customers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#94A3B8;">কোনো কাস্টমারের বাকি নেই</td></tr>`;
            return;
        }

        customers.forEach(c => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${c.name}</td>
                <td>${c.phone}</td>
                <td style="color:var(--danger-color); font-weight:bold;">৳${c.due.toFixed(2)}</td>
                <td><button class="btn btn-success" style="padding:2px 6px; font-size:0.75rem;" onclick="alert('বাকি আদায়ের ফিচার শীঘ্রই যুক্ত হবে')">জমা নিন</button></td>
            `;
            tbody.appendChild(tr);
        });
    };
}

// Expenses
function openExpenseModal() {
    document.getElementById("expReason").value = "";
    document.getElementById("expAmount").value = "";
    document.getElementById("expenseModal").style.display = "flex";
}

function closeExpenseModal() {
    document.getElementById("expenseModal").style.display = "none";
}

function saveExpenseData() {
    const reason = document.getElementById("expReason").value.trim();
    const amount = parseFloat(document.getElementById("expAmount").value) || 0;

    if (!reason || amount <= 0) {
        alert("খাতের বিবরণ এবং সঠিক পরিমাণ দিন!");
        return;
    }

    const transaction = db.transaction(["expenses"], "readwrite");
    const store = transaction.objectStore("expenses");
    store.add({ reason, amount, date: new Date().toISOString() });

    transaction.oncomplete = () => {
        closeExpenseModal();
        loadExpenses();
        refreshDashboardStats();
    };
}

function loadExpenses() {
    const transaction = db.transaction(["expenses"], "readonly");
    const store = transaction.objectStore("expenses");
    const request = store.getAll();

    request.onsuccess = () => {
        const expenses = request.result;
        const tbody = document.getElementById("expensesTableBody");
        tbody.innerHTML = "";

        if (expenses.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#94A3B8;">কোনো খরচ রেকর্ড নেই</td></tr>`;
            return;
        }

        expenses.reverse().forEach(e => {
            const dateStr = new Date(e.date).toLocaleDateString('bn-BD');
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${dateStr}</td>
                <td>${e.reason}</td>
                <td>৳${e.amount.toFixed(2)}</td>
                <td><button class="btn btn-outline-danger" style="padding:2px 6px; font-size:0.75rem;" onclick="deleteExpense(${e.id})"><i class="fa-solid fa-trash"></i></button></td>
            `;
            tbody.appendChild(tr);
        });
    };
}

function deleteExpense(id) {
    if (confirm("খরচটি মুছে ফেলতে চান?")) {
        const transaction = db.transaction(["expenses"], "readwrite");
        const store = transaction.objectStore("expenses");
        store.delete(id);
        transaction.oncomplete = () => {
            loadExpenses();
            refreshDashboardStats();
        };
    }
}

// Dashboard & Reports stats
function refreshDashboardStats() {
    const tx = db.transaction(["sales", "expenses", "products"], "readonly");
    
    // Sales stats
    tx.objectStore("sales").getAll().onsuccess = (e) => {
        const sales = e.target.result;
        let todaySales = 0;
        let totalDue = 0;
        let totalRevenue = 0;
        let totalCost = 0;
        const todayStr = new Date().toDateString();

        sales.forEach(s => {
            totalDue += s.due;
            totalRevenue += s.subtotal;
            if (new Date(s.date).toDateString() === todayStr) {
                todaySales += s.subtotal;
            }
            s.items.forEach(item => {
                totalCost += (item.costPrice || 0) * item.qty;
            });
        });

        document.getElementById("dashTodaySales").innerText = todaySales.toFixed(2);
        document.getElementById("dashTotalDue").innerText = totalDue.toFixed(2);
        document.getElementById("repTotalInvoices").innerText = `${sales.length} টি`;
        document.getElementById("repTotalSales").innerText = totalRevenue.toFixed(2);

        // Expenses stats
        tx.objectStore("expenses").getAll().onsuccess = (ev) => {
            const expenses = ev.target.result;
            let todayExp = 0;
            let totalExp = 0;

            expenses.forEach(ex => {
                totalExp += ex.amount;
                if (new Date(ex.date).toDateString() === todayStr) {
                    todayExp += ex.amount;
                }
            });

            document.getElementById("dashTodayExpense").innerText = todayExp.toFixed(2);
            document.getElementById("repTotalExpense").innerText = totalExp.toFixed(2);

            const netProfit = totalRevenue - totalCost - totalExp;
            document.getElementById("repTotalProfit").innerText = netProfit.toFixed(2);
        };

        // Stock count
        tx.objectStore("products").getAll().onsuccess = (evProd) => {
            const prods = evProd.result;
            let totalStock = prods.reduce((acc, p) => acc + p.stock, 0);
            document.getElementById("dashTotalStock").innerText = `${totalStock} টি`;
        };
    };
}

// Tab navigation handler
function switchTab(tabId, element) {
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(nav => nav.classList.remove("active"));
    
    document.getElementById(tabId).classList.add("active");
    element.classList.add("active");

    if (tabId === 'dashboard-tab' || tabId === 'reports-tab') refreshDashboardStats();
    if (tabId === 'products-tab') renderManageProducts();
    if (tabId === 'invoices-tab') loadAllInvoices();
    if (tabId === 'customers-tab') loadCustomers();
    if (tabId === 'expenses-tab') loadExpenses();

    if (window.innerWidth <= 768) {
        document.getElementById("sidebar").classList.remove("open");
    }
}

function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
}

// --- Print & PDF Preview ---
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

function reprintInvoice(id) {
    const transaction = db.transaction(["sales"], "readonly");
    const store = transaction.objectStore("sales");
    const req = store.get(id);

    req.onsuccess = () => {
        const s = req.result;
        if (!s) return;

        document.getElementById("printInvoiceNo").innerText = s.id;
        document.getElementById("printDate").innerText = new Date(s.date).toLocaleDateString('bn-BD');
        document.getElementById("printCustName").innerText = s.customerName;
        document.getElementById("printCustPhone").innerText = s.customerPhone;

        const printTbody = document.getElementById("printTableBody");
        printTbody.innerHTML = "";

        s.items.forEach((item, index) => {
            let itemTotal = item.price * item.qty;
            if (item.unit === "gm") itemTotal = (item.price / 1000) * item.qty;
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

        document.getElementById("printSubtotal").innerText = s.subtotal.toFixed(2);
        document.getElementById("printPaid").innerText = s.paid.toFixed(2);
        document.getElementById("printDue").innerText = s.due.toFixed(2);

        document.getElementById("printModal").style.display = "flex";
    };
}

// --- Backup and Restore ---
function exportDataBackup() {
    const tx = db.transaction(["products", "sales", "expenses", "settings"], "readonly");
    const backupData = {};

    tx.objectStore("products").getAll().onsuccess = (e) => {
        backupData.products = e.target.result;
        tx.objectStore("sales").getAll().onsuccess = (ev) => {
            backupData.sales = ev.target.result;
            tx.objectStore("expenses").getAll().onsuccess = (ev2) => {
                backupData.expenses = ev2.target.result;
                tx.objectStore("settings").getAll().onsuccess = (ev3) => {
                    backupData.settings = ev3.target.result;

                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", `smart_dokan_backup_${new Date().toISOString().slice(0,10)}.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                };
            };
        };
    };
}

function importDataBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            const tx = db.transaction(["products", "sales", "expenses", "settings"], "readwrite");

            if (data.products) {
                const pStore = tx.objectStore("products");
                pStore.clear();
                data.products.forEach(p => pStore.add(p));
            }
            if (data.sales) {
                const sStore = tx.objectStore("sales");
                sStore.clear();
                data.sales.forEach(s => sStore.put(s));
            }
            if (data.expenses) {
                const eStore = tx.objectStore("expenses");
                eStore.clear();
                data.expenses.forEach(ex => eStore.add(ex));
            }
            if (data.settings) {
                const setStore = tx.objectStore("settings");
                setStore.clear();
                data.settings.forEach(st => setStore.put(st));
            }

            tx.oncomplete = () => {
                alert("ডেটা সফলভাবে রিস্টোর করা হয়েছে!");
                location.reload();
            };
        } catch (err) {
            alert("ভুল ফরম্যাটের ব্যাকআপ ফাইল!");
        }
    };
    reader.readAsText(file);
}
