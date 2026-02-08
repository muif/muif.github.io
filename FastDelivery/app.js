/**
 * ------------------------------------------------------------------
 * PROJECT: FastDelivery System
 * FILE: app.js
 * VERSION: 9.4 (Modern UI Modals, Smart WhatsApp, Financial Fixes)
 * ------------------------------------------------------------------
 */

// ⚠️ هام: قم بلصق رابط النشر الجديد (Deployment URL) هنا
const API_URL = "https://script.google.com/macros/s/AKfycbzjKIHvRJDOwqOGFwPj_CuAfOVpo2xzQSRTrklp-5pEVZB6J3iBoUoJ2khEWTK1MX2e/exec"; 

// نغمة التنبيه
const NOTIF_SOUND = "https://cdn.pixabay.com/audio/2025/06/22/audio_76f254e734.mp3";

/**
 * ------------------------------------------------------------------
 * 1. CORE API CLASS
 * ------------------------------------------------------------------
 */
class Api {
    static async post(action, payload = {}, silent = false) {
        if (!silent) UI.showLoader();
        try {
            const data = { ...payload, action: action };
            const response = await fetch(API_URL, {
                redirect: "follow",
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(data)
            });
            const json = await response.json();
            if (!silent) UI.hideLoader();
            if (json.status === "error") {
                if (!silent) UI.showToast(json.message, "error");
                throw new Error(json.message);
            }
            return json.data;
        } catch (error) {
            if (!silent) {
                UI.hideLoader();
                console.warn("API Error:", error);
            }
            throw error;
        }
    }
}

/**
 * ------------------------------------------------------------------
 * 2. AUTH CLASS
 * ------------------------------------------------------------------
 */
class Auth {
    static login(userData) { sessionStorage.setItem("fds_user", JSON.stringify(userData)); }
    static logout() { sessionStorage.removeItem("fds_user"); window.location.href = "login.html"; }
    static getUser() { const user = sessionStorage.getItem("fds_user"); return user ? JSON.parse(user) : null; }
    static check() { if (!this.getUser()) { window.location.href = "login.html"; return false; } return true; }
    static checkRole(requiredRole) {
        const user = this.getUser();
        if (!user) { window.location.href = "login.html"; return false; }
        if (user.role !== requiredRole) {
            if (user.role === 'admin') return true;
            alert("غير مصرح لك بالدخول لهذه الصفحة");
            this.logout();
            return false;
        }
        return true;
    }
}

/**
 * ------------------------------------------------------------------
 * 3. FINANCE & REPORTING LOGIC
 * ------------------------------------------------------------------
 */
class Finance {
    static calculateCourierDebt(orders, courierUsername) {
        return orders
            .filter(o => o.courier_username === courierUsername && o.status === 'Delivered' && (!o.settled || o.settled === 'FALSE'))
            .reduce((sum, o) => sum + Number(o.amount), 0);
    }

    static filterOrdersByDate(orders, startDate, endDate) {
        const start = startDate ? new Date(startDate).setHours(0,0,0,0) : 0;
        const end = endDate ? new Date(endDate).setHours(23,59,59,999) : 9999999999999;
        
        return orders.filter(o => {
            const date = new Date(o.date_time).getTime();
            return date >= start && date <= end;
        });
    }

    static calculateStats(orders) {
        let totalSales = 0;
        let totalFees = 0;
        let totalNet = 0;

        orders.forEach(o => {
            if (o.status === 'Delivered' || o.status === 'Completed') {
                totalSales += Number(o.amount || 0);
                totalFees += Number(o.delivery_fee || 0);
                totalNet += Number(o.net_seller || 0);
            }
        });

        return { totalSales, totalFees, totalNet };
    }
}

/**
 * ------------------------------------------------------------------
 * 4. WHATSAPP HELPER (✅ V9.4 Fixed International Format)
 * ------------------------------------------------------------------
 */
class WhatsAppHelper {
    static formatPhone(phone) {
        if (!phone) return "";
        // إبقاء الأرقام فقط
        let p = phone.toString().replace(/\D/g, ''); 
        
        // حذف الصفر من البداية إن وجد
        if (p.startsWith('0')) p = p.substring(1);
        
        // إضافة الكود الدولي 964 إذا لم يكن موجوداً
        if (!p.startsWith('964')) p = '964' + p;
        
        return p;
    }

    static getLink(phone, message = "") {
        const p = this.formatPhone(phone);
        const msg = encodeURIComponent(message);
        return `https://wa.me/${p}?text=${msg}`;
    }

    static getButton(phone, message, label = "واتساب") {
        if(!phone) return "";
        return `<a href="${this.getLink(phone, message)}" target="_blank" class="btn btn-sm" style="background:#25D366; color:white; border:none; margin-right:5px; text-decoration:none; display:inline-flex; align-items:center; gap:5px;" onclick="event.stopPropagation()">
            <span style="font-size:1.2em;">💬</span> ${label}
        </a>`;
    }
}

/**
 * ------------------------------------------------------------------
 * 5. NOTIFICATION MANAGER
 * ------------------------------------------------------------------
 */
class NotificationManager {
    constructor() {
        this.notifications = []; 
        this.soundEnabled = localStorage.getItem('fds_sound') !== 'off'; 
        this.audio = new Audio(NOTIF_SOUND);
        this.lastReadTime = parseInt(localStorage.getItem('fds_last_read_time')) || 0;

        setTimeout(() => this.sync(), 2000);
        setInterval(() => this.sync(), 15000); 
	this.lastCount = 0;
    }

    async sync() {
        const user = Auth.getUser();
        if(!user) return;

        try {
            const serverNotifs = await Api.post('getNotifications', { 
                role: user.role, 
                username: user.username 
            }, true);

            if(serverNotifs && Array.isArray(serverNotifs)) {
                this.handleUpdates(serverNotifs);
            }
        } catch(e) { console.error("Notif Sync Failed", e); }
    }

  handleUpdates(serverNotifs) {
        // 1. نحسب عدد الإشعارات غير المقروءة حالياً
        // (أي الإشعارات التي وقتها أحدث من آخر مرة فتحت فيها القائمة)
        const unreadCount = serverNotifs.filter(n => n.date > this.lastReadTime).length;

        // 2. الشرط الذكي: هل زاد العدد عن المرة الماضية؟
        // هذا يمنع تكرار الصوت إذا كان العدد ثابتاً (مثلاً بقي 5)
        if (unreadCount > this.lastCount && unreadCount > 0) {
            
            // تشغيل الصوت مرة واحدة فقط
            this.playSound();

            // إظهار رسالة منبثقة لأحدث إشعار
            if (serverNotifs.length > 0) {
                const latest = serverNotifs[0];
                UI.showToast(`🔔 ${latest.text}`, latest.type || "info");
            }
        }

        // 3. تحديث الذاكرة للمرة القادمة
        this.lastCount = unreadCount;

        // 4. تحديث البيانات والواجهة (كما في الكود القديم)
        this.notifications = serverNotifs;
        this.updateBadge();
        
        const dropdown = document.getElementById('notif-dropdown');
        if(dropdown && dropdown.classList.contains('active')) {
            this.renderList(document.getElementById('notif-list'));
        }
    }

   updateBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;

    // حساب عدد غير المقروء
    const unreadCount = this.notifications.filter(n => n.date > this.lastReadTime).length;

    if (unreadCount > 0) {
        // إذا كان أكثر من 99 نكتب +99
        badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
        
        // ✅ التعديل: نعتمد على الكلاس فقط (CSS سيتكفل بالظهور والـ Flex)
        badge.classList.add('visible'); 
        
        // ❌ حذفنا badge.style.display = 'inline-block' لأنها تخرب التوسيط
    } else {
        badge.classList.remove('visible');
    }
}

    showDropdown() {
        const dropdown = document.getElementById('notif-dropdown');
        const listContainer = document.getElementById('notif-list');
        const soundIcon = document.getElementById('sound-icon');
        
        if (!dropdown || !listContainer) return;
        if (soundIcon) soundIcon.innerText = this.soundEnabled ? '🔊' : '🔇';

        if (dropdown.classList.contains('active')) {
            dropdown.classList.remove('active');
            return;
        }

        dropdown.classList.add('active');
        this.renderList(listContainer);
        this.markAsRead();
    }

    markAsRead() {
        if (this.notifications.length > 0) {
            const latestTime = this.notifications[0].date;
            this.lastReadTime = latestTime;
            localStorage.setItem('fds_last_read_time', latestTime);
            this.updateBadge();
        }
    }

    renderList(container) {
        container.innerHTML = '';
        if (this.notifications.length === 0) {
            container.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">لا توجد إشعارات حديثة</div>';
            return;
        }

        this.notifications.forEach((item, index) => {
            const date = new Date(item.date).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute:'2-digit' });
            const isUnread = item.date > this.lastReadTime;
            
            let typeColor = "#444";
            let icon = "📌";
            if(item.type === 'success') { typeColor = "var(--success)"; icon = "✅"; }
            if(item.type === 'warning') { typeColor = "var(--warning)"; icon = "⚠️"; }
            if(item.type === 'alert') { typeColor = "var(--danger)"; icon = "⛔"; }

            const html = `
                <div class="notif-item ${isUnread ? 'unread' : ''}" onclick="Notifier.handleNotificationClick(${index})" style="border-right: 4px solid ${typeColor}; padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
                    <div style="display:flex; gap:10px; align-items:center;">
                        <div style="font-size:1.2rem;">${icon}</div>
                        <div>
                            <div style="font-size:0.9rem; font-weight:bold;">${item.text}</div>
                            <span style="font-size:0.75rem; color:#888;">${date}</span>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += html;
        });
    }

    async handleNotificationClick(index) {
        const notif = this.notifications[index];
        if(!notif) return;

        const dropdown = document.getElementById('notif-dropdown');
        if(dropdown) dropdown.classList.remove('active');

        try {
            const details = await Api.post('getNotificationDetails', { 
                order_id: notif.order_id,
                actor_username: notif.actor 
            });
            UI.showDetailsModal(details, notif);
        } catch (e) {
            console.error("Fetch Details Error", e);
            UI.showToast("تعذر جلب التفاصيل", "error");
        }
    }

    playSound() {
        if (!this.soundEnabled) return;
        this.audio.currentTime = 0;
        this.audio.play().catch(e => console.warn("Audio blocked"));
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        localStorage.setItem('fds_sound', this.soundEnabled ? 'on' : 'off');
        const icon = document.getElementById('sound-icon');
        if (icon) icon.innerText = this.soundEnabled ? '🔊' : '🔇';
        if(this.soundEnabled) { this.playSound(); UI.showToast("تم تفعيل الصوت"); }
        else UI.showToast("تم كتم الصوت");
    }
}

/* --- تعديل: نظام الإشعارات الذكي (يمنع تكرار الصوت) --- */
const Notifier = new NotificationManager();

/**
 * ------------------------------------------------------------------
 * 6. UI CLASS (✅ V9.4 Modern Modals)
 * ------------------------------------------------------------------
 */

class UI {
    static showLoader() {
        let loader = document.getElementById("loader");
        if (!loader) {
            loader = document.createElement("div");
            loader.id = "loader";
            loader.className = "loader-overlay";
            loader.innerHTML = `<div class="spinner"></div>`;
            document.body.appendChild(loader);
        }
        loader.style.display = "flex";
    }

    static hideLoader() {
        const loader = document.getElementById("loader");
        if (loader) loader.style.display = "none";
    }

    static showToast(message, type = "success") {
        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            container.className = "toast-container";
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        toast.innerText = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    // ✅ نافذة تفاصيل الإشعار (تصميم عصري)
    static showDetailsModal(data, notif) {
        let modal = document.getElementById('detailsModal');
        if (modal) modal.remove();
        
        modal = document.createElement('div');
        modal.id = 'detailsModal';
        modal.className = 'modal-overlay active';
        
        // محتوى النافذة
        let content = `
            <div class="modal-content">
                <div class="modal-header-modern" style="background: linear-gradient(135deg, #4b5563, #1f2937);">
                    <h3 style="margin:0;">🔔 تفاصيل الإشعار</h3>
                    <div style="font-size:0.8rem; opacity:0.8; margin-top:5px;">${new Date(notif.date).toLocaleString('ar-IQ')}</div>
                </div>
                
                <div class="modal-body-modern">
                    <div style="background:#f3f4f6; padding:15px; border-radius:12px; font-weight:bold; color:#1f2937; margin-bottom:20px; border-left:4px solid var(--primary);">
                        ${notif.text}
                    </div>

                    ${data.actor ? `
                    <div class="detail-grid">
                        <div class="detail-label">👤 المرسل:</div>
                        <div class="detail-value">${data.actor.full_name} (${this.translateRole(data.actor.role)})</div>
                        ${data.actor.phone ? `<div class="detail-label">📞 الهاتف:</div><div class="detail-value"><a href="tel:${data.actor.phone}">${data.actor.phone}</a></div>` : ''}
                    </div>
                    <div class="detail-divider"></div>
                    ` : ''}

                    ${data.order ? `
                    <div style="margin-top:15px;">
                        <div style="font-weight:bold; margin-bottom:10px; color:var(--primary);">📦 معلومات الطلب المرتبط:</div>
                        <div class="detail-grid">
                            <div class="detail-label">رقم الطلب:</div>
                            <div class="detail-value">#${data.order.order_id.split('-')[1]}</div>
                            <div class="detail-label">الحالة:</div>
                            <div class="detail-value"><span class="badge badge-${data.order.status}">${translateStatus(data.order.status)}</span></div>
                            <div class="detail-label">المبلغ:</div>
                            <div class="detail-value">${Number(data.order.amount).toLocaleString()}</div>
                        </div>
                        <div style="margin-top:15px; text-align:center;">
                             <button id="btn-view-full-order" class="btn" style="background:var(--primary); color:white; width:100%;">عرض التفاصيل الكاملة 🔗</button>
                        </div>
                    </div>
                    ` : ''}

                    <div style="margin-top:20px;">
                        <button class="btn" style="background:#e5e7eb; color:#374151; width:100%;" onclick="UI.closeModal('detailsModal')">إغلاق</button>
                    </div>
                </div>
            </div>
        `;
        
        modal.innerHTML = content;
        document.body.appendChild(modal);

        if(data.order) {
            document.getElementById('btn-view-full-order').onclick = function() {
                UI.closeModal('detailsModal');
                UI.openOrderPage(data.order); 
            };
        }
    }

    // ✅ نافذة تفاصيل الطلب الموحدة (Modern Card Design - Grid System)
    static openOrderPage(order) {
        const old = document.getElementById('unifiedOrderModal');
        if(old) old.remove();

        const shortId = order.order_id.split('-')[1];
        const waCust = WhatsAppHelper.getButton(order.customer_phone, `مرحباً ${order.customer_name}، بخصوص طلبك رقم ${shortId}`, "واتساب العميل");
        
        // تحديد لون الهيدر حسب الحالة
        let headerColor = "var(--primary)";
        if(order.status === 'Cancelled') headerColor = "var(--danger)";
        if(order.status === 'Completed' || order.status === 'Delivered') headerColor = "var(--success)";
        if(order.status === 'Pending_Seller') headerColor = "var(--warning)";

        const modal = document.createElement('div');
        modal.id = 'unifiedOrderModal';
        modal.className = 'modal-overlay active'; 
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header-modern" style="background: ${headerColor};">
                    <h3 style="margin:0;">📦 طلب #${shortId}</h3>
                    <div style="font-size:0.8rem; opacity:0.9; margin-top:5px;">${new Date(order.date_time).toLocaleString('ar-IQ')}</div>
                    <div style="margin-top:5px;"><span class="badge" style="background:rgba(255,255,255,0.2); color:white;">${translateStatus(order.status)}</span></div>
                </div>
                
                <div class="modal-body-modern">
                    <div class="detail-grid">
                        <div class="detail-label">👤 العميل:</div>
                        <div class="detail-value">${order.customer_name}</div>
                        
                        <div class="detail-label">📞 الهاتف:</div>
                        <div class="detail-value" style="display:flex; flex-wrap:wrap; gap:5px;">
                            <a href="tel:${order.customer_phone}" style="text-decoration:none;">${order.customer_phone}</a>
                            ${waCust}
                        </div>
                        
                        <div class="detail-divider"></div>
                        
                        <div class="detail-label">📍 العنوان:</div>
                        <div class="detail-value" style="font-size:0.95rem; line-height:1.4;">${order.customer_address}</div>
                        
                        <div class="detail-divider"></div>
                        
                        <div class="detail-label" style="align-self:start;">📝 التفاصيل:</div>
                        <div class="detail-value" style="background:#f9fafb; padding:10px; border-radius:8px; line-height:1.5; color:#374151; border:1px dashed #e5e7eb;">
                            ${order.order_details}
                        </div>

                        ${order.notes ? `
                        <div class="detail-label">📋 ملاحظات:</div>
                        <div class="detail-value" style="color:#d97706; background:#fffbeb; padding:5px; border-radius:5px;">${order.notes}</div>` : ''}
                        
                        <div class="detail-divider"></div>

                        <div class="detail-label">💰 المبلغ:</div>
                        <div class="detail-value" style="font-size:1.3rem; color:var(--primary); font-weight:800;">
                            ${Number(order.amount).toLocaleString()} <span style="font-size:0.8rem; font-weight:normal; color:#666;">د.ع</span>
                        </div>
                        
                        <div class="detail-label">🏪 التاجر:</div>
                        <div class="detail-value">${order.seller_username}</div>
                        
                        <div class="detail-label">🛵 المندوب:</div>
                        <div class="detail-value">${order.courier_username || "---"}</div>
                    </div>

                    <div style="margin-top:20px; background:#f8fafc; padding:15px; border-radius:12px; border:1px solid #e2e8f0;">
                        <div style="font-weight:bold; color:#64748b; margin-bottom:10px;">📊 الملخص المالي:</div>
                        <div class="detail-grid" style="gap:5px;">
                            <div class="detail-label">سعر التوصيل:</div>
                            <div class="detail-value" style="color:var(--success);">+${Number(order.delivery_fee || 0).toLocaleString()}</div>
                            
                            <div class="detail-label">صافي التاجر:</div>
                            <div class="detail-value" style="color:#1e293b; font-weight:bold;">${Number(order.net_seller || 0).toLocaleString()}</div>
                            
                            <div class="detail-label">حالة التسوية:</div>
                            <div class="detail-value">${(order.settled === true || order.settled === 'TRUE') ? '✅ واصل للشركة' : '❌ بذمة المندوب'}</div>
                            
                            <div class="detail-label">حالة التاجر:</div>
                            <div class="detail-value">${(order.seller_paid === true || order.seller_paid === 'TRUE') ? '✅ تم الاستلام' : '⏳ بانتظار الدفع'}</div>
                        </div>
                    </div>

                    <div style="margin-top:20px;">
                        <button class="btn" style="background:#f1f5f9; color:#475569; width:100%; font-weight:bold;" onclick="document.getElementById('unifiedOrderModal').remove()">إغلاق النافذة</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    static translateRole(role) {
        const map = { 'admin': 'مدير', 'seller': 'تاجر', 'courier': 'مندوب', 'customer': 'عميل' };
        return map[role] || role;
    }

    static openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add("active");
    }

    static closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove("active");
    }

    static renderTable(data, columns, parentId, actionsCallback = null) {
        const parent = document.getElementById(parentId);
        if (!parent) return;

        if (!data || data.length === 0) {
            parent.innerHTML = `<tr><td colspan="${columns.length + (actionsCallback ? 1 : 0)}" style="text-align:center; padding: 20px; color: #888;">لا توجد بيانات متاحة</td></tr>`;
            return;
        }

        let html = "";
        data.forEach(row => {
            html += `<tr>`;
            columns.forEach(col => {
                let val = row[col.key];
                if (val === undefined || val === null) val = "-";
                if (col.key === 'status') val = `<span class="badge badge-${val}">${translateStatus(val)}</span>`;
                html += `<td data-label="${col.header}">${val}</td>`;
            });
            if (actionsCallback) {
                html += `<td data-label="إجراءات">${actionsCallback(row)}</td>`;
            }
            html += `</tr>`;
        });
        parent.innerHTML = html;
    }
}

function translateStatus(status) {
    const map = { 
        'Pending_Admin': '⏳ قيد المراجعة',
        'Pending_Seller': 'بانتظار التسعير',
        'New': 'جديد (للمناديب)', 
        'Assigned': 'تم الإسناد', 
        'PickedUp': 'جاري التوصيل', 
        'Delivered': 'تم التوصيل', 
        'Cancelled': 'ملغي', 
        'Completed': 'مكتمل' 
    };
    return map[status] || status;
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal-overlay')) {
         event.target.classList.remove('active');
         if(event.target.id === 'unifiedOrderModal') event.target.remove();
         if(event.target.id === 'detailsModal') event.target.classList.remove('active');
    }
    if (!event.target.closest('.notif-wrapper') && !event.target.closest('.notif-dropdown')) {
        const dropdown = document.getElementById('notif-dropdown');
        if (dropdown) dropdown.classList.remove('active');
    }
}
