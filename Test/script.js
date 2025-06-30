<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إدارة اشتراكات الإنترنت</title>
    <link rel="stylesheet" href="style.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body>

    <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <h3>القائمة</h3>
            <button class="close-btn" id="close-sidebar-btn">&times;</button>
        </div>
        <nav>
            <ul>
                <li><a href="#" class="nav-link active" data-page="home">الرئيسية (المشتركون)</a></li>
                <li><a href="#" class="nav-link" data-page="packages">إدارة الباقات</a></li>
            </ul>
        </nav>
        <div class="sidebar-footer">
            <h4>إدارة البيانات</h4>
            <button class="btn info-btn full-width" id="export-data-btn">تصدير البيانات (Backup)</button>
            <button class="btn secondary-btn full-width" id="import-data-btn">استيراد البيانات (Restore)</button>
            <input type="file" id="import-file-input" accept=".json" style="display: none;">
        </div>
    </aside>

    <div class="main-content" id="main-content">
        <header>
            <button class="menu-btn" id="menu-btn">
                <span></span>
                <span></span>
                <span></span>
            </button>
            <h1 id="page-title">المشتركون</h1>
        </header>

        <main>
            <section id="home-page" class="page active">
                <div class="card">
                    <div class="card-header">
                        <h2>قائمة المشتركين</h2>
                        <button id="add-subscriber-btn" class="btn primary-btn">إضافة مشترك جديد</button>
                    </div>
                    <div class="table-container">
                        <table id="subscribers-table">
                            <thead>
                                <tr>
                                    <th>الاسم</th>
                                    <th>رقم الهاتف</th>
                                    <th>الدين (دينار)</th>
                                </tr>
                            </thead>
                            <tbody>
                                </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section id="packages-page" class="page">
                <div class="card">
                    <div class="card-header">
                        <h2>إدارة الباقات</h2>
                    </div>
                    <div class="form-container">
                        <form id="package-form">
                            <input type="hidden" id="package-id">
                            <div class="form-group">
                                <label for="package-name">اسم الباقة</label>
                                <input type="text" id="package-name" required>
                            </div>
                            <div class="form-group">
                                <label for="package-price">السعر (دينار)</label>
                                <input type="number" id="package-price" required>
                            </div>
                            <div class="form-actions">
                                <button type="submit" class="btn primary-btn">حفظ الباقة</button>
                                <button type="button" id="cancel-edit-btn" class="btn secondary-btn" style="display: none;">إلغاء التعديل</button>
                            </div>
                        </form>
                    </div>
                    <div class="table-container">
                        <table id="packages-table">
                            <thead>
                                <tr>
                                    <th>اسم الباقة</th>
                                    <th>السعر (دينار)</th>
                                    <th>إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </main>
    </div>

    <div id="add-subscriber-modal" class="modal">
        <div class="modal-content">
            <span class="close-modal-btn">&times;</span>
            <h2>إضافة مشترك جديد</h2>
            <form id="add-subscriber-form">
                <div class="form-group">
                    <label for="subscriber-name">الاسم الكامل</label>
                    <input type="text" id="subscriber-name" required>
                </div>
                <div class="form-group">
                    <label for="subscriber-phone">رقم الهاتف</label>
                    <input type="tel" id="subscriber-phone" required>
                </div>
                <button type="submit" class="btn primary-btn">إضافة</button>
            </form>
        </div>
    </div>
    
    <div id="subscriber-details-modal" class="modal">
        <div class="modal-content large">
            <span class="close-modal-btn">&times;</span>
            <h2 id="details-subscriber-name">تفاصيل المشترك</h2>
            <div class="subscriber-info">
                <p><strong>رقم الهاتف:</strong> <span id="details-subscriber-phone"></span></p>
                <p><strong>الدين الإجمالي:</strong> <span id="details-subscriber-debt"></span></p>
            </div>
            <div class="actions-bar">
                 <button id="activate-subscription-btn" class="btn success-btn">تفعيل اشتراك</button>
                 <button id="record-payment-btn" class="btn info-btn">تسجيل دفعة</button>
            </div>
            <h3>سجل الحركات</h3>
            <div class="table-container">
                <table id="movements-table">
                    <thead>
                        <tr>
                            <th>النوع</th>
                            <th>الباقة</th>
                            <th>المبلغ (دينار)</th>
                            <th>تاريخ التفعيل</th>
                            <th>تاريخ الانتهاء</th>
                            <th>وقت العملية</th>
                            <th>ملاحظة</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    </div>
    
    <div id="activate-subscription-modal" class="modal">
        <div class="modal-content">
            <span class="close-modal-btn">&times;</span>
            <h2>تفعيل اشتراك جديد</h2>
            <form id="activate-subscription-form">
                <div class="form-group">
                    <label for="activation-package">اختر الباقة</label>
                    <select id="activation-package" required></select>
                </div>
                <div class="form-group">
                    <p><strong>السعر:</strong> <span id="activation-price-display">0</span> دينار</p>
                </div>
                 <div class="form-group">
                    <label for="activation-note">ملاحظة (اختياري)</label>
                    <textarea id="activation-note" rows="2"></textarea>
                </div>
                <button type="submit" class="btn primary-btn">تأكيد التفعيل</button>
            </form>
        </div>
    </div>
    
    <div id="record-payment-modal" class="modal">
        <div class="modal-content">
            <span class="close-modal-btn">&times;</span>
            <h2>تسجيل دفعة</h2>
            <form id="record-payment-form">
                 <div class="form-group">
                    <label for="payment-amount">مبلغ الدفعة (دينار)</label>
                    <input type="number" id="payment-amount" required min="1">
                </div>
                 <div class="form-group">
                    <label for="payment-note">ملاحظة (اختياري)</label>
                    <textarea id="payment-note" rows="2"></textarea>
                </div>
                <button type="submit" class="btn primary-btn">تسجيل الدفعة</button>
            </form>
        </div>
    </div>

    <div id="notification-container"></div>
    
    <script src="script.js"></script>
</body>
</html>
