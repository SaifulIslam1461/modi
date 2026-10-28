// --- IndexedDB Database Configuration ---
const DB_NAME = "SmartDokanDB";
const DB_VERSION = 1;
let db = null;

// Initial Default Products for Seed
const defaultProducts = [
    { name: "আলু (Potato)", costPrice: 38, price: 45, stock: 50, unitOptions: ["kg", "gm"], image: "" },
    { name: "দেশি পেঁয়াজ", costPrice: 75, price: 85, stock: 40, unitOptions: ["kg", "gm"], image: "" },
    { name: "মিনিক্যাট চাল", costPrice: 65, price: 72, stock: 100, unitOptions: ["kg", "gm", "bag"], image: "" },
    { name: "মসুর ডাল", costPrice: 115, price: 130, stock: 30, unitOptions: ["kg", "gm"], image: "" },
    { name: "অলিম্পিক বিস্কুট", costPrice: 8, price: 10, stock: 60, unitOptions: ["pcs"], image: "" },
    { name: "সয়াবিন তেল (১ লিটার)", costPrice: 150, price: 165, stock: 25, unitOptions: ["pcs", "litre"], image: "" }
];

// App State
let productsCache = [];
let draftInvoices = [];
let activeDraftId = null;
let invoiceCounter = 1001;
let shopSettings = { 
    name: "বিসমিল্লাহ্‌ স্টোর", 
    address: "পরশুরাম বাজার, ফেনী", 
    phone: "০১৭১২-০০০০০০",
    email: "",
    ownerName: "সাইফুল ইসলাম",
    ownerTitle: "স্বত্বাধিকারী",
    logo: "",
    signature: "",
    themeColor: "#0F2D1E"
};

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
            shopSettings = Object.assign(shopSettings, request.result.data);
        } else {
            saveAppSettingsToDB();
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
    document.getElementById("settingShopName").value = shopSettings.name || "";
    document.getElementById("settingShopAddress").value = shopSettings.address || "";
    document.getElementById("settingShopPhone").value = shopSettings.phone || "";
    document.getElementById("settingShopEmail").value = shopSettings.email || "";
    document.getElementById("settingOwnerName").value = shopSettings.ownerName || "";
    document.getElementById("settingOwnerTitle").value = shopSettings.ownerTitle || "";
    document.getElementById("settingThemeColor").value = shopSettings.themeColor || "#0F2D1E";

    document.documentElement.style.setProperty('--invoice-theme', shopSettings.themeColor || "#0F2D1E");
}

function saveSettingsData() {
    shopSettings.name = document.getElementById("settingShopName").value || "Smart Dokan";
    shopSettings.address = document.getElementById("settingShopAddress").value || "";
    shopSettings.phone = document.getElementById("settingShopPhone").value || "";
    shopSettings.email = document.getElementById("settingShopEmail").value || "";
    shopSettings.ownerName = document.getElementById("settingOwnerName").value || "স্বত্বাধিকারী";
    shopSettings.ownerTitle = document.getElementById("settingOwnerTitle").value || "";
    shopSettings.themeColor = document.getElementById("settingThemeColor").value || "#0F2D1E";

    const logoInput = document.getElementById("settingShopLogo");
    const signInput = document.getElementById("settingOwnerSign");

    const readFiles = async () => {
        if (logoInput.files && logoInput.files[0]) {
            shopSettings.logo = await fileToBase64(logoInput.files[0]);
        }
        if (signInput.files && signInput.files[0]) {
            shopSettings.signature = await fileToBase64(signInput.files[0]);
        }
        saveAppSettingsToDB();
        applySettingsToUI();
        alert("ইনভয়েস ও দোকানের সেটিংস সফলভাবে সংরক্ষিত হয়েছে!");
    };

    readFiles();
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// --- Products CRUD & DB ---
function loadProductsFromDB() {
    const transaction = db.transaction(["products"], "readonly");
    const store = transaction.objectStore("products");
    const request = store.getAll();

    request.onsuccess = () => {
        productsCache = request.result;
        if (productsCache.length === 0) {
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
    if (!grid) return;
    grid.innerHTML = "";

    products.forEach(p => {
        const card = document.createElement("div");
        card.className = "product-item";
        card.onclick = () => addProductToActiveInvoice(p);
        
        let imgTag = p.image ? `<img src="${p.image}" class="product-thumb">` : `<i class="fa-solid fa-box-open" style="font-size: 1.8rem; color:#D4AF37; margin-bottom: 4px;"></i>`;

        card.innerHTML = `
            ${imgTag}
            <h4>${p.name}</h4>
            <p><i class="fa-solid fa-tag"></i> ৳ ${p.price}</p>
            <small style="font-size:0.7rem; color:#64748B;"><i class="fa-solid fa-boxes-stacked"></i> স্টক: ${p.stock}</small>
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
    if (!tbody) return;
    tbody.innerHTML = "";
    const query = document.getElementById("manageProductSearch") ? document.getElementById("manageProductSearch").value.toLowerCase() : "";

    const filtered = productsCache.filter(p => p.name.toLowerCase().includes(query));

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94A3B8;">কোনো পণ্য পাওয়া যায়নি</td></tr>`;
        return;
    }

    filtered.forEach(p => {
        let imgTag = p.image ? `<img src="${p.image}" style="width:30px; height:30px; object-fit:cover; border-radius:4px;">` : `<i class="fa-solid fa-image" style="color:#CBD5E1;"></i>`;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${imgTag}</td>
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
    document.getElementById("modalProdImage").value = "";
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
    const imageInput = document.getElementById("modalProdImage");

    if (!name || price <= 0) {
        alert("পণ্যের নাম এবং সঠিক বিক্রয়মূল্য দিন!");
        return;
    }

    const processSave = (imgBase64) => {
        const transaction = db.transaction(["products"], "readwrite");
        const store = transaction.objectStore("products");

        let existingImg = "";
        if (id) {
            const existing = productsCache.find(p => p.id === parseInt(id));
            if (existing) existingImg = existing.image || "";
        }

        const productObj = { 
            name, 
            costPrice, 
            price, 
            stock, 
            unitOptions, 
            image: imgBase64 || existingImg 
        };

        if (id) {
            productObj.id = parseInt(id);
            store.put(productObj);
        } else {
            store.add(productObj);
        }

        transaction.oncomplete = () => {
            closeProductModal();
            loadProductsFromDB();
            refreshDashboardStats();
        };
    };

    if (imageInput.files && imageInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            processSave(e.target.result);
        };
        reader.readAsDataURL(imageInput.files[0]);
    } else {
        processSave(null);
    }
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
            refreshDashboardStats();
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
        discount: 0,
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
    if (!container) return;
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

    document.getElementById("activeInvoiceNo").innerHTML = `<i class="fa-solid fa-receipt"></i> চালান #${draft.id}`;
    document.getElementById("custName").value = draft.customerName;
    document.getElementById("custPhone").value = draft.customerPhone;
    document.getElementById("discountAmount").value = draft.discount || 0;
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
    if (!tbody) return;
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
            <td><input type="number" step="any" value="${item.price}" class="price-input" onchange="updateItemPrice(${idx}, this.value)"></td>
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

function updateItemPrice(index, val) {
    const draft = getActiveDraft();
    const p = parseFloat(val);
    if (draft && !isNaN(p) && p >= 0) {
        draft.items[index].price = p;
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

    const discount = parseFloat(document.getElementById("discountAmount").value) || 0;
    draft.discount = discount;
    const paid = parseFloat(document.getElementById("paidAmount").value) || 0;
    draft.paid = paid;

    let finalTotal = subtotal - discount;
    if (finalTotal < 0) finalTotal = 0;
    const due = finalTotal - paid;

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

    let finalTotal = subtotal - (draft.discount || 0);
    if (finalTotal < 0) finalTotal = 0;
    const dueAmount = finalTotal - draft.paid > 0 ? finalTotal - draft.paid : 0;

    const saleRecord = {
        id: draft.id,
        customerName: draft.customerName || "সাধারণ কাস্টমার",
        customerPhone: draft.customerPhone || "N/A",
        items: draft.items,
        subtotal: finalTotal,
        rawSubtotal: subtotal,
        discount: draft.discount || 0,
        paid: draft.paid,
        due: dueAmount,
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
        if (!tbody) return;
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
        if (!tbody) return;
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
        if (!tbody) return;
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

// --- Dashboard & Filters ---
let currentDashboardFilter = 'today';
let dashboardChartInstance = null;

function setDashboardFilter(filterType, btnElement) {
    currentDashboardFilter = filterType;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    const customBox = document.getElementById("customDateBox");
    if (filterType === 'custom') {
        customBox.classList.add('show');
    } else {
        customBox.classList.remove('show');
        refreshDashboardStats();
    }
}

function applyCustomDateFilter() {
    if (currentDashboardFilter === 'custom') {
        refreshDashboardStats();
    }
}

function isDateInFilterRange(dateString, filterType) {
    const itemDate = new Date(dateString);
    const now = new Date();

    if (filterType === 'today') {
        return itemDate.toDateString() === now.toDateString();
    } else if (filterType === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        return itemDate.toDateString() === yesterday.toDateString();
    } else if (filterType === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        return itemDate >= oneWeekAgo && itemDate <= now;
    } else if (filterType === 'month') {
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    } else if (filterType === 'year') {
        return itemDate.getFullYear() === now.getFullYear();
    } else if (filterType === 'custom') {
        const startVal = document.getElementById("filterStartDate").value;
        const endVal = document.getElementById("filterEndDate").value;
        if (!startVal || !endVal) return true;
        const startDate = new Date(startVal);
        startDate.setHours(0,0,0,0);
        const endDate = new Date(endVal);
        endDate.setHours(23,59,59,999);
        return itemDate >= startDate && itemDate <= endDate;
    }
    return true;
}

function refreshDashboardStats() {
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    const dateStr = new Date().toLocaleDateString('bn-BD', options);
    const dateElem = document.getElementById("dashDateText");
    if (dateElem) dateElem.innerText = dateStr;

    const tx = db.transaction(["sales", "expenses", "products"], "readonly");

    tx.objectStore("sales").getAll().onsuccess = (e) => {
        const sales = e.target.result;
        let periodSales = 0;
        let periodGrossProfit = 0;
        let totalDue = 0;
        let totalCollected = 0;
        let totalRevenue = 0;
        let totalInvoicesCount = sales.length;
        const uniqueCustomers = new Set();

        sales.forEach(s => {
            totalDue += s.due;
            totalCollected += s.paid;
            totalRevenue += s.subtotal;
            if (s.customerName && s.customerName !== "সাধারণ কাস্টমার") {
                uniqueCustomers.add(s.customerName);
            }

            let saleCost = 0;
            s.items.forEach(item => {
                let itemCost = (item.costPrice || 0) * item.qty;
                if (item.unit === "gm") itemCost = ((item.costPrice || 0) / 1000) * item.qty;
                saleCost += itemCost;
            });

            if (isDateInFilterRange(s.date, currentDashboardFilter)) {
                periodSales += s.subtotal;
                periodGrossProfit += (s.subtotal - saleCost);
            }
        });

        document.getElementById("dashTotalDue").innerText = totalDue.toFixed(2);
        document.getElementById("dashTotalCustomers").innerText = `${uniqueCustomers.size} জন`;
        document.getElementById("repTotalInvoices").innerText = `${totalInvoicesCount} টি`;
        document.getElementById("repTotalSales").innerText = totalRevenue.toFixed(2);

        tx.objectStore("expenses").getAll().onsuccess = (ev) => {
            const expenses = ev.target.result;
            let periodExpense = 0;
            let totalExpense = 0;

            expenses.forEach(ex => {
                totalExpense += ex.amount;
                if (isDateInFilterRange(ex.date, currentDashboardFilter)) {
                    periodExpense += ex.amount;
                }
            });

            const netProfit = periodGrossProfit - periodExpense;
            document.getElementById("dashPeriodSales").innerText = periodSales.toFixed(2);
            document.getElementById("dashPeriodExpense").innerText = periodExpense.toFixed(2);
            document.getElementById("dashPeriodNetProfit").innerText = netProfit.toFixed(2);
            document.getElementById("dashPeriodCollected").innerText = totalCollected.toFixed(2);
            document.getElementById("repTotalExpense").innerText = totalExpense.toFixed(2);
            document.getElementById("repTotalProfit").innerText = (totalRevenue - totalExpense).toFixed(2);

            // Recent Transactions Table Update
            const recentTbody = document.getElementById("dashRecentSalesTableBody");
            if (recentTbody) {
                recentTbody.innerHTML = "";
                const filteredSales = sales.filter(s => isDateInFilterRange(s.date, currentDashboardFilter));
                const displaySales = filteredSales.length > 0 ? filteredSales : sales;

                if (displaySales.length === 0) {
                    recentTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94A3B8;">কোনো লেনদেন পাওয়া যায়নি</td></tr>`;
                } else {
                    [...displaySales].reverse().slice(0, 6).forEach(s => {
                        const dStr = new Date(s.date).toLocaleDateString('bn-BD');
                        const statusBadge = s.due === 0 ? '<span class="badge badge-success">নগদ</span>' : '<span class="badge badge-warning">বাকি</span>';
                        const tr = document.createElement("tr");
                        tr.innerHTML = `
                            <td>${s.id}</td>
                            <td>${dStr}</td>
                            <td>${s.customerName}</td>
                            <td>৳${s.subtotal.toFixed(2)}</td>
                            <td>৳${s.paid.toFixed(2)}</td>
                            <td style="color:var(--danger-color);">৳${s.due.toFixed(2)}</td>
                            <td>${statusBadge}</td>
                        `;
                        recentTbody.appendChild(tr);
                    });
                }
            }
        };

        // Stock metrics & Low stock warnings
        tx.objectStore("products").getAll().onsuccess = (evProd) => {
            const prods = evProd.result;
            let totalStockQty = 0;
            let totalStockVal = 0;
            let lowStockItems = [];

            prods.forEach(p => {
                totalStockQty += p.stock;
                totalStockVal += (p.costPrice || 0) * p.stock;
                if (p.stock <= 10) {
                    lowStockItems.push(p);
                }
            });

            document.getElementById("dashTotalStock").innerText = `${totalStockQty} টি`;
            document.getElementById("dashTotalStockValue").innerText = totalStockVal.toFixed(2);

            const alertCard = document.getElementById("lowStockAlertSection");
            const chipsContainer = document.getElementById("lowStockChipsContainer");
            if (lowStockItems.length > 0) {
                alertCard.style.display = "block";
                chipsContainer.innerHTML = lowStockItems.map(p => `<div class="stock-chip">${p.name} (অবশিষ্ট: ${p.stock})</div>`).join('');
            } else {
                alertCard.style.display = "none";
            }

            renderDashboardChart(sales);
        };
    };
}

function renderDashboardChart(sales) {
    const ctx = document.getElementById('salesProfitChart');
    if (!ctx) return;

    const dateMap = {};
    sales.forEach(s => {
        if (isDateInFilterRange(s.date, currentDashboardFilter)) {
            const dateKey = new Date(s.date).toLocaleDateString('bn-BD', { month: 'short', day: 'numeric' });
            let cost = 0;
            s.items.forEach(i => {
                let c = (i.costPrice || 0) * i.qty;
                if (i.unit === "gm") c = ((i.costPrice || 0)/1000) * i.qty;
                cost += c;
            });
            const profit = s.subtotal - cost;

            if (!dateMap[dateKey]) {
                dateMap[dateKey] = { sales: 0, profit: 0 };
            }
            dateMap[dateKey].sales += s.subtotal;
            dateMap[dateKey].profit += profit;
        }
    });

    const labels = Object.keys(dateMap);
    const salesData = labels.map(l => dateMap[l].sales);
    const profitData = labels.map(l => dateMap[l].profit);

    if (dashboardChartInstance) {
        dashboardChartInstance.destroy();
    }

    dashboardChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.length > 0 ? labels : ['আজ'],
            datasets: [
                {
                    label: 'বিক্রি (৳)',
                    data: salesData.length > 0 ? salesData : [0],
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'লাভ (৳)',
                    data: profitData.length > 0 ? profitData : [0],
                    borderColor: '#D4AF37',
                    backgroundColor: 'rgba(212, 175, 55, 0.1)',
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// Navigation
function switchTab(tabId, element) {
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(nav => nav.classList.remove("active"));
    
    document.getElementById(tabId).classList.add("active");
    if (element) element.classList.add("active");

    if (tabId === 'dashboard-tab' || tabId === 'reports-tab') refreshDashboardStats();
    if (tabId === 'products-tab') renderManageProducts();
    if (tabId === 'invoices-tab') loadAllInvoices();
    if (tabId === 'customers-tab') loadCustomers();
    if (tabId === 'expenses-tab') loadExpenses();

    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById("sidebar");
        if (sidebar) sidebar.classList.remove("open");
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.toggle("open");
}

// --- Printable Invoice Data Populator ---
let currentActiveInvoiceObj = null;

function populatePrintData(invoiceData) {
    currentActiveInvoiceObj = invoiceData;
    const themeColor = shopSettings.themeColor || '#0F2D1E';
    document.documentElement.style.setProperty('--invoice-theme', themeColor);

    document.getElementById("printShopName").innerText = shopSettings.name || "বিসমিল্লাহ্‌ স্টোর";
    document.getElementById("printShopAddress").innerText = shopSettings.address || "";
    document.getElementById("printShopPhone").innerText = shopSettings.phone || "";
    
    const emailWrapper = document.getElementById("printShopEmailWrapper");
    if (shopSettings.email) {
        document.getElementById("printShopEmail").innerText = shopSettings.email;
        emailWrapper.style.display = "inline";
    } else {
        emailWrapper.style.display = "none";
    }

    const logoImg = document.getElementById("printShopLogo");
    if (shopSettings.logo) {
        logoImg.src = shopSettings.logo;
        logoImg.style.display = "block";
    } else {
        logoImg.style.display = "none";
    }

    document.getElementById("printInvoiceNo").innerText = invoiceData.id;
    document.getElementById("printDate").innerText = new Date(invoiceData.date || Date.now()).toLocaleDateString('bn-BD');
    document.getElementById("printCustName").innerText = invoiceData.customerName || "সাধারণ কাস্টমার";
    document.getElementById("printCustPhone").innerText = invoiceData.customerPhone || "N/A";

    const printTbody = document.getElementById("printTableBody");
    printTbody.innerHTML = "";

    let rawTotal = 0;
    invoiceData.items.forEach((item, index) => {
        let itemTotal = item.price * item.qty;
        if (item.unit === "gm") itemTotal = (item.price / 1000) * item.qty;
        rawTotal += itemTotal;

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

    const discount = invoiceData.discount || 0;
    let netTotal = rawTotal - discount;
    if (netTotal < 0) netTotal = 0;
    const due = invoiceData.due !== undefined ? invoiceData.due : (netTotal - (invoiceData.paid || 0));

    document.getElementById("printSubtotal").innerText = rawTotal.toFixed(2);
    document.getElementById("printDiscount").innerText = discount.toFixed(2);
    document.getElementById("printNetTotal").innerText = netTotal.toFixed(2);
    document.getElementById("printPaid").innerText = (invoiceData.paid || 0).toFixed(2);
    document.getElementById("printDue").innerText = due > 0 ? due.toFixed(2) : "0.00";

    const badge = document.getElementById("printPaymentStatusBadge");
    if (due <= 0) {
        badge.innerText = "পরিশোধিত (Paid)";
        badge.className = "invoice-status-badge status-paid";
    } else if ((invoiceData.paid || 0) > 0) {
        badge.innerText = "আংশিক বাকি (Partial)";
        badge.className = "invoice-status-badge status-partial";
    } else {
        badge.innerText = "সম্পূর্ণ বাকি (Due)";
        badge.className = "invoice-status-badge status-due";
    }

    document.getElementById("printOwnerName").innerText = shopSettings.ownerName || "মালিক";
    document.getElementById("printOwnerTitle").innerText = shopSettings.ownerTitle || "স্বত্বাধিকারী";

    const signImg = document.getElementById("printOwnerSignImg");
    if (shopSettings.signature) {
        signImg.src = shopSettings.signature;
        signImg.style.display = "block";
    } else {
        signImg.style.display = "none";
    }
}

// --- Dynamic WhatsApp PDF Sharing ---
async function shareInvoicePDFToWhatsApp() {
    if (!currentActiveInvoiceObj) {
        alert("চালানের তথ্য পাওয়া যায়নি!");
        return;
    }

    const element = document.getElementById("printableArea");
    const rawInvoiceId = currentActiveInvoiceObj.id || "INV-1001";
    const pdfFilename = `Invoice_${rawInvoiceId}.pdf`;
    const custPhone = (currentActiveInvoiceObj.customerPhone || "").trim();

    // Format phone number to international format (Bangladesh +880)
    let formattedPhone = custPhone.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) {
        formattedPhone = '88' + formattedPhone;
    }

    const shareMsgText = `আসসালামু আলাইকুম। ${shopSettings.name || 'দোকান'} থেকে আপনার ক্রয়ের চালানটি PDF আকারে পাঠানো হলো। ধন্যবাদ।`;

    const opt = {
        margin: 0.3,
        filename: pdfFilename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    try {
        // Generate PDF Blob
        const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
        const pdfFile = new File([pdfBlob], pdfFilename, { type: 'application/pdf' });

        // Web Share API Check
        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
            await navigator.share({
                title: `${pdfFilename}`,
                text: shareMsgText,
                files: [pdfFile]
            });
        } else {
            // Fallback: Download PDF & Open WhatsApp text flow with prompt
            const blobUrl = URL.createObjectURL(pdfBlob);
            const downloadLink = document.createElement('a');
            downloadLink.href = blobUrl;
            downloadLink.download = pdfFilename;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            const whatsappUrl = formattedPhone.length > 5 ? 
                `https://wa.me/${formattedPhone}?text=${encodeURIComponent(shareMsgText)}` : 
                `https://wa.me/?text=${encodeURIComponent(shareMsgText)}`;

            alert(`আপনার PDF চালানটি ডাউনলোড হয়েছে (${pdfFilename})। এখন WhatsApp নির্বাচন করে ফাইলটি অ্যাটাচ করে পাঠিয়ে দিন।`);
            window.open(whatsappUrl, '_blank');
        }
    } catch (err) {
        console.error("PDF Share Error:", err);
        alert("PDF শেয়ার করতে সমস্যা হয়েছে! চালান ডাউনলোড বাটনে চাপ দিয়ে সংরক্ষণ করুন।");
    }
}

function openPrintPreview() {
    const draft = getActiveDraft();
    if (!draft || draft.items.length === 0) {
        alert("প্রিন্ট দেখার জন্য চালানে অন্তত একটি পণ্য যোগ করুন!");
        return;
    }

    let subtotal = 0;
    draft.items.forEach(item => {
        if (item.unit === "gm") subtotal += (item.price / 1000) * item.qty;
        else subtotal += item.price * item.qty;
    });

    const discount = draft.discount || 0;
    let netTotal = subtotal - discount;
    if (finalTotal < 0) finalTotal = 0;
    const due = netTotal - draft.paid;

    const previewObj = {
        id: draft.id,
        customerName: draft.customerName || "সাধারণ কাস্টমার",
        customerPhone: draft.customerPhone || "N/A",
        items: draft.items,
        discount: discount,
        paid: draft.paid,
        due: due > 0 ? due : 0,
        date: new Date().toISOString()
    };

    populatePrintData(previewObj);
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
        populatePrintData(s);
        document.getElementById("printModal").style.display = "flex";
    };
}

// Backup and Restore
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
