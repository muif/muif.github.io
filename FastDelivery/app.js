/**
 * ------------------------------------------------------------------
 * PROJECT: FastDelivery System
 * FILE: app.js
 * VERSION: 8.1 (Unified UI, WhatsApp, Full Notification Details)
 * ------------------------------------------------------------------
 */

// ✅ الرابط الجديد (V8.0 Backend)
const API_URL = "https://script.google.com/macros/s/AKfycbzQq0vOm2EEM-FT5voPYern9KkZCRcSN75ceo4XvH1G6LqfTBMEEd70jqkzcdT82GVc/exec";

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
 * 4. WHATSAPP HELPER (NEW V8.0)
 * ------------------------------------------------------------------
 */
class WhatsAppHelper {
    static formatPhone(phone) {
        if (!phone) return "";
        let p = phone.toString().replace(/\D/g, ''); // إزالة الرموز
        // معالجة الأرقام العراقية القياسية
        if (p.startsWith('07')) p = '964' + p.substring(1); 
        if (p.startsWith('7')) p = '964' + p;
        return p;
    }

    static getLink(phone, message = "") {
        const p = this.formatPhone(phone);
        const msg = encodeURIComponent(message);
        return `https://wa.me/${p}?text=${msg}`;
    }

    static getButton(phone, message, label = "واتساب") {
        if(!phone) return "";
        return `<a href="${this.getLink(phone, message)}" target="_blank" class="btn btn-sm btn-success" style="background:#25D366; border:none; margin-right:5px;" onclick="event.stopPropagation()">
            <span style="font-size:1.1em; vertical-align:middle;">💬</span> ${label}
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
        const newestServerTime = serverNotifs.length > 0 ? serverNotifs[0].date : 0;
        const currentLatest = this.notifications.length > 0 ? this.notifications[0].date : 0;

        if (newestServerTime > currentLatest && newestServerTime > this.lastReadTime) {
            const latest = serverNotifs[0];
            UI.showToast(`🔔 ${latest.text}`, latest.type || "info");
            this.playSound();
        }

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
        const unreadCount = this.notifications.filter(n => n.date > this.lastReadTime).length;

        if (unreadCount > 0) {
            badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
            badge.classList.add('visible');
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
            container.innerHTML = '<div class="notif-empty">لا توجد إشعارات حديثة</div>';
            return;
        }

        this.notifications.forEach((item, index) => {
            const date = new Date(item.date).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute:'2-digit' });
            const isUnread = item.date > this.lastReadTime;
            
            let typeColor = "#444";
            let icon = "📌";
            if(item.type === 'success') { typeColor = "var(--success)"; icon = "✅"; }
            if(item.type === 'warning') { typeColor = "var(--warning)"; icon = "⚠️"; }
            if(item.type === 'alert') { typeColor = "var(--accent)"; icon = "⛔"; }

            const html = `
                <div class="notif-item ${isUnread ? 'unread' : ''}" onclick="Notifier.handleNotificationClick(${index})" style="border-right: 3px solid ${typeColor}">
                    <div style="font-size:1.2rem;">${icon}</div>
                    <div>
                        <div>${item.text}</div>
                        <span class="notif-time">${date}</span>
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
            
            // ✅ استخدام دالة العرض التفصيلي الخاصة بالإشعارات (لعرض الفاعل)
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

const Notifier = new NotificationManager();

/**
 * ------------------------------------------------------------------
 * 6. UI CLASS (COMPREHENSIVE V8.1)
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

    // ✅ دالة 1: عرض تفاصيل الإشعار (مستعادة من V7.0 + تحسينات)
    // هذه الدالة تعرض من قام بالفعل (Actor) والطلب المرتبط
    static showDetailsModal(data, notif) {
        let modal = document.getElementById('detailsModal');
        
        // إعادة بناء النافذة لضمان نظافتها
        if (modal) modal.remove();
        
        modal = document.createElement('div');
        modal.id = 'detailsModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h3 style="border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:15px;">📝 تفاصيل الإشعار</h3>
                
                <div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:15px;">
                    <p id="dm-msg" style="font-size:1.1rem; font-weight:bold; color:#333;"></p>
                    <small id="dm-time" style="color:#888;"></small>
                </div>

                <div id="dm-actor-sec" style="margin-bottom:15px; display:none;">
                    <label style="color:var(--primary); font-weight:bold;">👤 قام بهذا الإجراء:</label>
                    <div style="display:flex; justify-content:space-between; margin-top:5px; background:#fff; padding:10px; border:1px solid #eee; border-radius:8px;">
                        <span id="dm-actor-name" style="font-weight:bold;"></span>
                        <a id="dm-actor-phone" href="#" style="text-decoration:none;"></a>
                    </div>
                </div>

                <div id="dm-order-sec" style="margin-bottom:15px; display:none; border:1px dashed #ccc; padding:10px; border-radius:8px;">
                    <label style="color:var(--primary); font-weight:bold;">📦 ملخص الطلب المرتبط:</label>
                    <table style="width:100%; font-size:0.9rem; margin-top:5px;">
                        <tr><td style="color:#666;">رقم الطلب:</td><td id="dm-ord-id" style="font-weight:bold;"></td></tr>
                        <tr><td style="color:#666;">المبلغ:</td><td id="dm-ord-amount"></td></tr>
                        <tr><td style="color:#666;">الحالة:</td><td id="dm-ord-status"></td></tr>
                        <tr><td style="color:#666;">المندوب الحالي:</td><td id="dm-ord-courier"></td></tr>
                    </table>
                    <div style="margin-top:10px; text-align:center;">
                         <button id="btn-view-full-order" class="btn btn-sm btn-info">عرض التفاصيل الكاملة والواتساب 🔗</button>
                    </div>
                </div>

                <button class="btn btn-primary btn-block" onclick="UI.closeModal('detailsModal')">إغلاق</button>
            </div>
        `;
        document.body.appendChild(modal);

        // تعبئة البيانات
        document.getElementById('dm-msg').innerText = notif.text;
        document.getElementById('dm-time').innerText = new Date(notif.date).toLocaleString('ar-IQ');

        // بيانات المرسل (الفاعل) - مهمة جداً للمدير
        const actorSec = document.getElementById('dm-actor-sec');
        if (data.actor) {
            actorSec.style.display = 'block';
            document.getElementById('dm-actor-name').innerText = `${data.actor.full_name} (${this.translateRole(data.actor.role)})`;
            const ph = document.getElementById('dm-actor-phone');
            if(data.actor.phone && data.actor.phone !== '-') {
                ph.innerText = `📞 ${data.actor.phone}`;
                ph.href = `tel:${data.actor.phone}`;
            } else {
                ph.innerText = "";
            }
        } else {
            actorSec.style.display = 'none';
        }

        // بيانات الطلب المختصرة
        const orderSec = document.getElementById('dm-order-sec');
        if (data.order) {
            orderSec.style.display = 'block';
            document.getElementById('dm-ord-id').innerText = data.order.order_id;
            document.getElementById('dm-ord-amount').innerText = Number(data.order.amount).toLocaleString();
            document.getElementById('dm-ord-status').innerHTML = `<span class="badge badge-${data.order.status}">${translateStatus(data.order.status)}</span>`;
            document.getElementById('dm-ord-courier').innerText = data.order.courier_username || "غير مسند";
            
            // ربط زر "عرض التفاصيل الكاملة" بالدالة الجديدة
            document.getElementById('btn-view-full-order').onclick = function() {
                UI.closeModal('detailsModal');
                UI.openOrderPage(data.order); // الانتقال للنافذة الموحدة الجديدة
            };
        } else {
            orderSec.style.display = 'none';
        }

        this.openModal('detailsModal');
    }

    // ✅ دالة 2: نافذة تفاصيل الطلب الموحدة (الجديدة V8.0)
    // تستخدم عند النقر على جدول الطلبات أو الانتقال من الإشعار
    static openOrderPage(order) {
        // إزالة أي نافذة قديمة
        const old = document.getElementById('unifiedOrderModal');
        if(old) old.remove();

        // تجهيز أزرار الواتساب باستخدام الكلاس الجديد
        const waCust = WhatsAppHelper.getButton(order.customer_phone, `مرحباً ${order.customer_name}، بخصوص طلبك رقم ${order.order_id}`, "واتساب العميل");
        
        // واتساب التاجر (إذا توفر رقمه في المستقبل يمكن جلبه، حالياً نعتمد على الزر العام)
        // const waSeller = ... 

        const modal = document.createElement('div');
        modal.id = 'unifiedOrderModal';
        modal.className = 'modal-overlay active'; // تفتح مباشرة
        modal.innerHTML = `
            <div class="modal-content" style="max-width:600px;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:15px;">
                    <h3>📦 تفاصيل الطلب #${order.order_id.split('-')[1]}</h3>
                    <span class="badge badge-${order.status}" style="font-size:1rem;">${translateStatus(order.status)}</span>
                </div>
                
                <table class="detail-table">
                    <tr><td style="width:30%;">التاريخ:</td><td>${new Date(order.date_time).toLocaleString('ar-IQ')}</td></tr>
                    <tr><td>العميل:</td><td>${order.customer_name}</td></tr>
                    <tr><td>الهاتف:</td><td>${order.customer_phone} <br> ${waCust}</td></tr>
                    <tr><td>العنوان:</td><td>${order.customer_address}</td></tr>
                    <tr><td>التفاصيل:</td><td>${order.order_details}</td></tr>
                    <tr><td>الملاحظات:</td><td style="color:var(--warning);">${order.notes || "لا يوجد"}</td></tr>
                    <tr><td>المبلغ الكلي:</td><td style="font-weight:bold; font-size:1.1rem;">${Number(order.amount).toLocaleString()}</td></tr>
                    <tr><td>التاجر:</td><td>${order.seller_username}</td></tr>
                    <tr><td>المندوب:</td><td>${order.courier_username || "غير مسند"}</td></tr>
                    
                    <tr style="border-top:2px solid #eee;"><td colspan="2" style="padding-top:10px; font-weight:bold; color:var(--primary);">📊 البيانات المالية:</td></tr>
                    <tr><td>صافي التاجر:</td><td style="color:var(--primary); font-weight:bold;">${Number(order.net_seller).toLocaleString()}</td></tr>
                    <tr><td>سعر التوصيل:</td><td style="color:var(--success);">${Number(order.delivery_fee).toLocaleString()}</td></tr>
                    <tr><td>حالة التسوية:</td><td>${(order.settled === true || order.settled === 'TRUE') ? '✅ تم التسديد للشركة' : '❌ في ذمة المندوب'}</td></tr>
                    <tr><td>حالة التاجر:</td><td>${(order.seller_paid === true || order.seller_paid === 'TRUE') ? '✅ تم استلام المبلغ' : '⏳ بانتظار الاستلام'}</td></tr>
                </table>

                <div style="margin-top:20px;">
                    <button class="btn btn-block" style="background:#eee; color:#333;" onclick="document.getElementById('unifiedOrderModal').remove()">إغلاق</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    static translateRole(role) {
        const map = { 'admin': 'مدير', 'seller': 'تاجر', 'courier': 'مندوب' };
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
    const map = { 'New': 'جديد', 'Assigned': 'تم الإسناد', 'PickedUp': 'جاري التوصيل', 'Delivered': 'تم التوصيل', 'Cancelled': 'ملغي', 'Completed': 'مكتمل' };
    return map[status] || status;
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal-overlay')) {
         event.target.classList.remove('active');
         // إزالة النوافذ الديناميكية عند النقر خارجها
         if(event.target.id === 'unifiedOrderModal') event.target.remove();
         if(event.target.id === 'detailsModal') event.target.classList.remove('active');
    }
    if (!event.target.closest('.notif-wrapper') && !event.target.closest('.notif-dropdown')) {
        const dropdown = document.getElementById('notif-dropdown');
        if (dropdown) dropdown.classList.remove('active');
    }
}
