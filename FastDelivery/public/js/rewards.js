import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// درع الإخفاء وحماية الواجهة
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === 'customer') {
            document.body.style.display = 'block'; // رفع الدرع
            const userData = userDoc.data();

            // 1. حساب النقاط والرتبة
            const points = userData.loyalty_points || 0;
            document.getElementById('total-points').innerText = points;
            calculateTier(points);

            // 2. حساب عدد الطلبات والتوفير (خدعة تسويقية لطيفة)
            calculateStats(user.uid, points);

        } else {
            window.location.href = 'login.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});

function calculateTier(points) {
    let tierName = "مبتدئ";
    let nextTierPoints = 100;
    let progress = 0;
    let badgeColor = "#f1f5f9";
    let textColor = "#475569";

    if (points < 100) {
        tierName = "برونزي"; nextTierPoints = 100; progress = (points / 100) * 100;
        badgeColor = "#ffedd5"; textColor = "#b45309";
    } else if (points >= 100 && points < 500) {
        tierName = "فضي"; nextTierPoints = 500; progress = ((points - 100) / 400) * 100;
        badgeColor = "#f1f5f9"; textColor = "#64748b";
    } else if (points >= 500 && points < 1500) {
        tierName = "ذهبي"; nextTierPoints = 1500; progress = ((points - 500) / 1000) * 100;
        badgeColor = "#fef3c7"; textColor = "#d97706";
    } else {
        tierName = "VIP 🔥"; nextTierPoints = points; progress = 100;
        badgeColor = "#fce7f3"; textColor = "#db2777";
    }

    const badge = document.getElementById('tier-badge');
    document.getElementById('tier-name').innerText = tierName;
    badge.style.background = badgeColor;
    badge.style.color = textColor;

    document.getElementById('tier-progress').style.width = `${progress}%`;

    if (tierName === "VIP 🔥") {
        document.getElementById('tier-message').innerText = "أنت في أعلى رتبة! استمتع بمميزاتك الحصرية.";
    } else {
        document.getElementById('points-needed').innerText = (nextTierPoints - points);
    }
}

async function calculateStats(uid, points) {
    try {
        const q = query(collection(db, "orders"), where("customer_id", "==", uid), where("status", "==", "DELIVERED"));
        const snap = await getDocs(q);

        const ordersCount = snap.size;
        document.getElementById('total-orders-count').innerText = ordersCount;

        // خدعة التوفير: نفترض أن كل نقطة ولاء تعادل 25 دينار توفير للعميل (أو يمكن حسابها بناءً على خصومات حقيقية لاحقاً)
        const estimatedSavings = points * 1.5;
        document.getElementById('total-savings').innerText = estimatedSavings.toLocaleString() + ' د.ع';

    } catch (e) {
        console.error("خطأ في جلب الإحصائيات", e);
    }
}

// ============================================================================
// 🚀 توجيه زر الطلب الحر لفتح النافذة برابط مباشر (الطريقة المضمونة)
// ============================================================================
const fabBtn = document.getElementById('open-direct-order-btn');
if (fabBtn) {
    fabBtn.addEventListener('click', () => {
        // نضع الإشارة في الرابط نفسه بدلاً من الذاكرة
        window.location.href = 'index.html?action=order';
    });
}