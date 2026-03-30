// ============================================================================
// شاشة القيادة المركزية والرادار الحي (Live Map & Command Center) المطور
// ============================================================================

import { db } from '../../shared/firebase-config.js';
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const navLiveMap = document.getElementById('nav-live-map');
const viewLiveMap = document.getElementById('view-live-map');

let map = null;

// 🚀 الذاكرة الذكية لتتبع الدبابيس ومنع تكرارها
let driverMarkers = {};
let orderMarkers = {};

const driverIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3097/3097180.png',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

const orderIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
});

navLiveMap.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(view => view.style.display = 'none');

    navLiveMap.classList.add('active');
    viewLiveMap.style.display = 'block';
    document.getElementById('page-title').innerText = 'الخريطة الحية (القيادة المركزية)';

    if (!map) {
        map = L.map('map').setView([32.062, 45.244], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);

        startRadar();
    }

    setTimeout(() => { map.invalidateSize(); }, 100);
});

function startRadar() {
    // --- 1. الرادار الحي للمناديب ---
    const qDrivers = query(collection(db, "users"), where("role", "==", "driver"), where("is_active", "==", true));

    onSnapshot(qDrivers, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const driver = change.doc.data();
            const driverId = change.doc.id;

            if (change.type === "added" || change.type === "modified") {
                if (driver.current_location && driver.current_location.lat && driver.current_location.lng) {
                    const latLng = [driver.current_location.lat, driver.current_location.lng];

                    if (driverMarkers[driverId]) {
                        // 🚀 المندوب موجود: حرك الدبوس بنعومة لموقعه الجديد
                        driverMarkers[driverId].setLatLng(latLng);
                        driverMarkers[driverId].getPopup().setContent(`<b>المندوب:</b> ${driver.name}<br><b>الذمة:</b> ${driver.wallet_balance || 0} د.ع`);
                    } else {
                        // 🚀 مندوب جديد دخل الخريطة: ارسمه
                        const marker = L.marker(latLng, { icon: driverIcon })
                            .addTo(map)
                            .bindPopup(`<b>المندوب:</b> ${driver.name}<br><b>الذمة:</b> ${driver.wallet_balance || 0} د.ع`);
                        driverMarkers[driverId] = marker;
                    }
                }
            }
            if (change.type === "removed") {
                // المندوب خرج من النظام أو أصبح غير نشط: احذفه من الخريطة
                if (driverMarkers[driverId]) {
                    map.removeLayer(driverMarkers[driverId]);
                    delete driverMarkers[driverId];
                }
            }
        });
    });

    // --- 2. الرادار الحي للطلبات ---
    const qOrders = query(collection(db, "orders"), where("status", "in", ["ASSIGNED", "IN_TRANSIT"]));

    onSnapshot(qOrders, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const order = change.doc.data();
            const orderId = change.doc.id;

            if (change.type === "added" || change.type === "modified") {
                // 💡 ملاحظة: إذا كان تطبيق العميل يرسل الإحداثيات، استبدل العشوائية بـ order.location.lat
                const lat = 32.062 + (Math.random() - 0.5) * 0.02;
                const lng = 45.244 + (Math.random() - 0.5) * 0.02;
                const latLng = [lat, lng];

                if (orderMarkers[orderId]) {
                    // الطلب موجود مسبقاً، فقط حدث حالته في النافذة
                    orderMarkers[orderId].getPopup().setContent(`
                        <b>طلب:</b> ${order.order_details}<br>
                        <b>الحالة:</b> <span style="color:${order.status === 'ASSIGNED' ? '#e74c3c' : '#f39c12'}; font-weight:bold;">${order.status === 'ASSIGNED' ? 'بانتظار المندوب' : 'في الطريق للعميل'}</span>
                    `);
                } else {
                    // طلب جديد ظهر في الميدان
                    const marker = L.marker(latLng, { icon: orderIcon })
                        .addTo(map)
                        .bindPopup(`
                            <b>طلب:</b> ${order.order_details}<br>
                            <b>الحالة:</b> <span style="color:${order.status === 'ASSIGNED' ? '#e74c3c' : '#f39c12'}; font-weight:bold;">${order.status === 'ASSIGNED' ? 'بانتظار المندوب' : 'في الطريق للعميل'}</span>
                        `);
                    orderMarkers[orderId] = marker;
                }
            }
            if (change.type === "removed" || !["ASSIGNED", "IN_TRANSIT"].includes(order.status)) {
                // الطلب تم تسليمه أو إلغاؤه: احذفه من الخريطة فوراً
                if (orderMarkers[orderId]) {
                    map.removeLayer(orderMarkers[orderId]);
                    delete orderMarkers[orderId];
                }
            }
        });
    });
}