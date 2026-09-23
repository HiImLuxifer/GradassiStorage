/* ══════════════════════════════════════════════
   GradassiStorage — Authentication Manager
   Firebase Auth (Email & Password)
   ══════════════════════════════════════════════ */

class AuthManager {
    constructor() {
        this.auth = firebase.auth();
        this.currentUser = null;
        this.onAuthChangedCallbacks = [];
        this._ready = false;
        this._readyPromise = new Promise(resolve => {
            this._resolveReady = resolve;
        });

        this.init();
    }

    // ── Initialization ──
    init() {
        this.auth.onAuthStateChanged(user => {
            this.currentUser = user;
            this.updateUI(user);
            this.onAuthChangedCallbacks.forEach(cb => cb(user));

            if (!this._ready) {
                this._ready = true;
                this._resolveReady(user);
            }
        });

        this.bindLoginModal();
    }

    /** Wait for the first auth state resolution */
    waitForReady() {
        return this._readyPromise;
    }

    // ── Auth Operations ──

    async login(email, password) {
        try {
            this.setLoginLoading(true);
            this.clearLoginError();
            await this.auth.signInWithEmailAndPassword(email, password);
            this.closeLoginModal();
            this.showToast('success', '👋', `Bentornato!`);
        } catch (error) {
            this.showLoginError(this.translateError(error.code));
        } finally {
            this.setLoginLoading(false);
        }
    }

    async register() {
        this.showLoginError('La registrazione è disabilitata. Contatta l\'amministratore.');
    }

    async logout() {
        try {
            await this.auth.signOut();
            this.showToast('info', '👋', 'Disconnesso con successo');
        } catch (error) {
            console.error('Logout error:', error);
            this.showToast('error', '❌', 'Errore durante la disconnessione');
        }
    }

    isLoggedIn() {
        return !!this.currentUser;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    /** Register a callback for auth state changes */
    onAuthChanged(callback) {
        this.onAuthChangedCallbacks.push(callback);
    }

    // ── UI Update ──

    updateUI(user) {
        const authElements = document.querySelectorAll('[data-auth-required]');
        const sidebarUserInfo = document.getElementById('sidebar-user-info');
        const sidebarLoginBtn = document.getElementById('sidebar-login-btn');
        const mobileLoginBtn = document.getElementById('mobile-login-btn');

        if (user) {
            // User is logged in — show protected elements
            authElements.forEach(el => {
                el.classList.remove('auth-hidden');
                el.removeAttribute('disabled');
            });

            // Sidebar user badge
            if (sidebarUserInfo) {
                const initial = (user.email || '?')[0].toUpperCase();
                sidebarUserInfo.innerHTML = `
                    <div class="user-badge">
                        <div class="user-avatar">${initial}</div>
                        <div class="user-details">
                            <span class="user-email" title="${this.escapeHtml(user.email)}">${this.escapeHtml(user.email)}</span>
                        </div>
                    </div>
                `;
                sidebarUserInfo.style.display = '';
            }

            // Show logout button, hide login button
            if (sidebarLoginBtn) sidebarLoginBtn.style.display = 'none';
            if (mobileLoginBtn) mobileLoginBtn.style.display = 'none';
            document.getElementById('sidebar-logout-btn')?.style && (document.getElementById('sidebar-logout-btn').style.display = '');

        } else {
            // User is not logged in — hide protected elements
            authElements.forEach(el => {
                el.classList.add('auth-hidden');
            });

            // Clear sidebar user badge
            if (sidebarUserInfo) {
                sidebarUserInfo.innerHTML = '';
                sidebarUserInfo.style.display = 'none';
            }

            // Show login button, hide logout button
            if (sidebarLoginBtn) sidebarLoginBtn.style.display = '';
            if (mobileLoginBtn) mobileLoginBtn.style.display = '';
            document.getElementById('sidebar-logout-btn')?.style && (document.getElementById('sidebar-logout-btn').style.display = 'none');
        }
    }

    // ── Login Modal ──

    bindLoginModal() {
        // Login form submit
        document.getElementById('auth-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value.trim();
            const password = document.getElementById('auth-password').value;
            if (!email || !password) {
                this.showLoginError('Inserisci email e password');
                return;
            }

            if (password.length < 6) {
                this.showLoginError('La password deve avere almeno 6 caratteri');
                return;
            }

            this.login(email, password);
        });

        // Close modal
        document.getElementById('auth-modal-close')?.addEventListener('click', () => this.closeLoginModal());
        document.getElementById('auth-modal-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeLoginModal();
        });

        // Sidebar login/logout buttons
        document.getElementById('sidebar-login-btn')?.addEventListener('click', () => this.openLoginModal());
        document.getElementById('sidebar-logout-btn')?.addEventListener('click', () => this.logout());
        document.getElementById('mobile-login-btn')?.addEventListener('click', () => this.openLoginModal());

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const overlay = document.getElementById('auth-modal-overlay');
                if (overlay?.classList.contains('open')) {
                    this.closeLoginModal();
                }
            }
        });
    }

    openLoginModal() {
        const overlay = document.getElementById('auth-modal-overlay');
        if (overlay) {
            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
            // Focus email field
            setTimeout(() => {
                document.getElementById('auth-email')?.focus();
            }, 300);
        }
    }

    closeLoginModal() {
        const overlay = document.getElementById('auth-modal-overlay');
        if (overlay) {
            overlay.classList.remove('open');
            // Only restore scroll if no other modal is open
            const editOpen = document.getElementById('edit-modal-overlay')?.classList.contains('open');
            const deleteOpen = document.getElementById('delete-modal-overlay')?.classList.contains('open');
            if (!editOpen && !deleteOpen) {
                document.body.style.overflow = '';
            }
        }
        // Reset form
        document.getElementById('auth-form')?.reset();
        this.clearLoginError();
    }

    showLoginError(message) {
        const errorEl = document.getElementById('auth-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }

    clearLoginError() {
        const errorEl = document.getElementById('auth-error');
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
    }

    setLoginLoading(loading) {
        const btn = document.getElementById('auth-submit-btn');
        if (btn) {
            btn.classList.toggle('loading', loading);
            btn.disabled = loading;
        }
    }

    // ── Helpers ──

    /** Check auth before protected action. Returns true if allowed, false if blocked. */
    requireAuth(actionName) {
        if (this.isLoggedIn()) return true;

        this.showToast('warning', '🔒', `Accedi per ${actionName || 'questa operazione'}`);
        this.openLoginModal();
        return false;
    }

    translateError(code) {
        const errors = {
            'auth/invalid-email': 'Indirizzo email non valido',
            'auth/user-disabled': 'Questo account è stato disabilitato',
            'auth/user-not-found': 'Nessun account trovato con questa email',
            'auth/wrong-password': 'Password errata',
            'auth/invalid-credential': 'Credenziali non valide. Controlla email e password.',
            'auth/email-already-in-use': 'Questa email è già registrata',
            'auth/weak-password': 'La password deve avere almeno 6 caratteri',
            'auth/too-many-requests': 'Troppi tentativi. Riprova tra qualche minuto.',
            'auth/network-request-failed': 'Errore di rete. Controlla la connessione.',
            'auth/operation-not-allowed': 'Registrazione non abilitata. Contatta l\'amministratore.',
        };
        return errors[code] || 'Si è verificato un errore. Riprova.';
    }

    showToast(type, icon, message) {
        // Reuse the app's toast system if available
        if (typeof app !== 'undefined' && app.toast) {
            app.toast(type, icon, message);
        } else {
            // Fallback: create a simple toast
            const container = document.getElementById('toast-container');
            if (!container) return;
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerHTML = `
                <span class="toast-icon">${icon}</span>
                <span class="toast-message">${message}</span>
            `;
            container.appendChild(toast);
            setTimeout(() => {
                toast.classList.add('out');
                setTimeout(() => toast.remove(), 300);
            }, 3500);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

// ─── Global Auth Instance ───
let authManager;
