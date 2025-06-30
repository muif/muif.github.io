// app.js - Final Debugging Version
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed.');

    const App = {
        // ... (The entire App object from the previous full response)
        // I will only show the modified init() function for brevity
        // Please use the full code from my previous "app.js (مكتمل وجاهز)" response
        // and only replace this init() function.
        
        // --- INITIALIZER ---
        init() {
            console.log('App.init() started.');
            this.showLoader(); // Show loader immediately

            try {
                this.registerServiceWorker();
                this.initTheme();
                this.initEventListeners();
                
                console.log('Attempting to initialize database...');
                this.DB.init().then(db => {
                    console.log('Database initialized successfully.');
                    this.state.db = db;
                    
                    console.log('Attempting to load initial data...');
                    this.loadInitialData().then(() => {
                        console.log('Initial data loaded successfully.');
                        this.loadSettings();
                        this.router();
                        console.log('App initialization finished.');
                        this.hideLoader(); // Hide loader only on full success
                    }).catch(dataErr => {
                        console.error('Failed during data loading:', dataErr);
                        this.showNotification('فشل تحميل البيانات', 'error');
                        this.hideLoader();
                    });

                }).catch(dbErr => {
                    console.error('Database initialization failed:', dbErr);
                    this.showNotification('فشل في تهيئة قاعدة البيانات!', 'error');
                    this.hideLoader();
                });
            } catch (error) {
                console.error('A critical error occurred during init:', error);
                this.showNotification('حدث خطأ فادح!', 'error');
                this.hideLoader();
            }
        },
        
        // --- PWA & SERVICE WORKER ---
        registerServiceWorker() {
            if ('serviceWorker' in navigator) {
                // Use the most robust registration method
                navigator.serviceWorker.register('./sw.js', { scope: './' })
                    .then(() => console.log('Service Worker registered successfully.'))
                    .catch(error => console.error('Service Worker registration failed:', error));
            } else {
                console.log('Service Worker not supported in this browser.');
            }
        },

        // --- The rest of the App object should be pasted here ---
        // (state, other functions like router, DB, Render, Actions)
        // Use the full code from the previous response for the rest.
    };
    
    // For this to work, you need to copy the *entire* App object from the 
    // previous "app.js (مكتمل وجاهز)" response, and then replace its 
    // init() and registerServiceWorker() functions with the ones above.

    // A simplified version to ensure you have the full structure:
    // const FullApp = { ... full object from previous response ... };
    // FullApp.init = App.init; // Replace with the new init
    // FullApp.registerServiceWorker = App.registerServiceWorker; // Replace with the new register
    // window.App = { Actions: FullApp.Actions };
    // FullApp.init();

    // To avoid confusion, I recommend you take the full app.js code I sent before
    // and just manually edit the init() and registerServiceWorker() functions
    // to match the code above.
});
