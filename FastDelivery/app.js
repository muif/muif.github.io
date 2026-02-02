/**
 * ------------------------------------------------------------------
 * PROJECT: FastDelivery System
 * FILE: app.js
 * VERSION: 2.0 (Fixed Silent Mode & Full Logic)
 * AUTHOR: Senior Lead Developer
 * ------------------------------------------------------------------
 */

// 🛑 هام جداً: استبدل الرابط أدناه برابط Web App الخاص بك بعد النشر
const API_URL = "https://script.google.com/macros/s/AKfycbxutXLOtvyf8ucBRNy7CQOO4J2cr8OFq1ZfYgbLS2N0LBgDqYG22hZpGofbcJT_8TSa/exec";

/**
 * ------------------------------------------------------------------
 * API CLASS
 * Handles communication with Google Apps Script Backend
 * ------------------------------------------------------------------
 */
class Api {
    /**
     * Sends a POST request to the backend.
     * @param {string} action - The action name (e.g., 'getOrders')
     * @param {object} payload - The data to send
     * @param {boolean} silent - If true, loader and error toasts are hidden (Background Mode)
     */
    static async post(action, payload = {}, silent = false) {
        // 1. Show Loader ONLY if not in silent mode
        // هذا هو التعديل الجوهري لمنع ظهور العجلة أثناء التحديث التلقائي
        if (silent === false) {
            UI.showLoader();
        }

        try {
            // Append action to payload
            const data = { ...payload, action: action };

            // Fetch Options:
            // method: POST
            // body: JSON string
            // header: text/plain to avoid CORS Preflight (OPTIONS request) issues with GAS.
            const response = await fetch(API_URL, {
                redirect: "follow",
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8", 
                },
                body: JSON.stringify(data)
            });

            const json = await response.json();
            
            // 2. Hide Loader ONLY if not in silent mode
            if (silent === false) {
                UI.hideLoader();
            }

            // Handle Logical Errors from Server (e.g., "User not found")
            if (json.status === "error") {
                // Only show toast error if user initiated the action
                if (silent === false) {
                    UI.showToast(json.message, "error");
                }
                throw new Error(json.message);
            }

            return json.data;

        } catch (error) {
            // Ensure loader is hidden even if fetch fails
            if (silent === false) {
                UI.hideLoader();
                console.error("API Error:", error);
                
                // If it's a network error or generic error, show toast
                if (!error.message || error.message === 'Failed to fetch') {
                    UI.showToast("خطأ في الاتصال بالخادم", "error");
                } else {
                    UI.showToast(error.message, "error");
                }
            } else {
                // In silent mode, just log to console for debugging
                console.warn("Silent API Refresh Failed:", error);
            }
            
            throw error;
        }
    }
}

/**
 * ------------------------------------------------------------------
 * AUTH CLASS
 * Manages User Session (Login, Logout, Role Check)
 * ------------------------------------------------------------------
 */
class Auth {
    // Save user object to SessionStorage
    static login(userData) {
        sessionStorage.setItem("fds_user", JSON.stringify(userData));
    }

    // Clear session and redirect
    static logout() {
        sessionStorage.removeItem("fds_user");
        window.location.href = "login.html";
    }

    // Retrieve current user data
    static getUser() {
        const user = sessionStorage.getItem("fds_user");
        return user ? JSON.parse(user) : null;
    }

    // Verify if logged in, otherwise redirect
    static check() {
        if (!this.getUser()) {
            window.location.href = "login.html";
            return false;
        }
        return true;
    }

    // strict role checking
    static checkRole(requiredRole) {
        const user = this.getUser();
        if (!user) {
            window.location.href = "login.html";
            return false;
        }

        if (user.role !== requiredRole) {
            // Exception: Admin can typically access everything (optional)
            if (user.role === 'admin') return true; 
            
            alert("غير مصرح لك بالدخول لهذه الصفحة (Unauthorized)");
            this.logout();
            return false;
        }
        return true;
    }
}

/**
 * ------------------------------------------------------------------
 * UI CLASS
 * Handles visual feedback (Modals, Toasts, Loaders, Tables)
 * ------------------------------------------------------------------
 */
class UI {
    // --- Loader Management ---
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

    // --- Toast Notifications ---
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

        // Remove after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // --- Modals Management ---
    static openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add("active");
    }

    static closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove("active");
    }

    // --- Dynamic Table Renderer ---
    /**
     * @param {Array} data - Array of objects to render
     * @param {Array} columns - Array of {key, header} objects
     * @param {string} parentId - ID of tbody element
     * @param {Function} actionsCallback - Optional function to return action HTML buttons
     */
    static renderTable(data, columns, parentId, actionsCallback = null) {
        const parent = document.getElementById(parentId);
        if (!parent) return;

        // Empty State
        if (!data || data.length === 0) {
            parent.innerHTML = `<tr><td colspan="${columns.length + (actionsCallback ? 1 : 0)}" style="text-align:center; padding: 20px; color: #888;">لا توجد بيانات متاحة</td></tr>`;
            return;
        }

        let html = "";
        data.forEach(row => {
            html += `<tr>`;
            columns.forEach(col => {
                let val = row[col.key];
                
                // Handle null/undefined
                if (val === undefined || val === null) val = "-";

                // Specific formatting for 'status' column
                if (col.key === 'status') {
                    val = `<span class="badge badge-${val}">${translateStatus(val)}</span>`;
                }

                html += `<td>${val}</td>`;
            });

            // Append Action Buttons if callback provided
            if (actionsCallback) {
                html += `<td>${actionsCallback(row)}</td>`;
            }
            html += `</tr>`;
        });

        parent.innerHTML = html;
    }
}

// --- Global Utilities ---

/**
 * Translate English Status to Arabic
 */
function translateStatus(status) {
    const map = {
        'New': 'جديد',
        'Assigned': 'تم الإسناد',
        'PickedUp': 'جاري التوصيل',
        'Delivered': 'تم التوصيل',
        'Cancelled': 'ملغي'
    };
    return map[status] || status;
}

// Close modals when clicking outside the content area
window.onclick = function(event) {
    if (event.target.classList.contains('modal-overlay')) {
        event.target.classList.remove('active');
    }
}
