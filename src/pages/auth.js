import { supabase } from '../utils/supabase.js';
import { store } from '../store.js';
import { showToast } from '../components/toast.js';

export function renderAuth() {
    const container = document.createElement('div');
    container.className = 'auth-container animate-fade-in';

    container.innerHTML = `
        <div class="auth-card card">
            <div class="auth-header">
                <h2 id="auth-title">ログイン</h2>
                <p class="text-muted text-sm" id="auth-subtitle">KURONYLAB 収益管理システムへようこそ</p>
            </div>
            
            <form id="auth-form" class="mt-lg">
                <div class="form-group">
                    <label class="form-label">メールアドレス</label>
                    <input type="email" id="auth-email" class="form-input" required placeholder="example@mail.com">
                </div>
                <div class="form-group">
                    <label class="form-label">パスワード</label>
                    <input type="password" id="auth-password" class="form-input" required placeholder="••••••••">
                </div>
                
                <button type="submit" class="btn btn-primary w-full mt-md" id="btn-auth-submit">ログイン</button>
            </form>
            
            <div class="auth-footer mt-lg text-center">
                <a href="#" id="link-toggle-auth" class="text-sm text-primary">アカウントを作成する</a>
            </div>
        </div>
    `;

    // スタイル調整用（必要なら index.css に追記すべきだが、ここでは最小限）
    const style = document.createElement('style');
    style.textContent = `
        .auth-container {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: calc(100vh - 100px);
        }
        .auth-card {
            width: 100%;
            max-width: 400px;
            padding: 2.5rem;
        }
        .auth-header h2 {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }
        .w-full { width: 100%; }
    `;
    container.appendChild(style);

    return container;
}

export function onAuthMount() {
    let mode = 'login'; // 'login' | 'signup'

    const form = document.getElementById('auth-form');
    const title = document.getElementById('auth-title');
    const submitBtn = document.getElementById('btn-auth-submit');
    const toggleLink = document.getElementById('link-toggle-auth');

    toggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        mode = mode === 'login' ? 'signup' : 'login';

        title.textContent = mode === 'login' ? 'ログイン' : '新規登録';
        submitBtn.textContent = mode === 'login' ? 'ログイン' : '登録する';
        toggleLink.textContent = mode === 'login' ? 'アカウントを作成する' : '既にアカウントをお持ちの方';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;

        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;

        try {
            if (mode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                // showToastは main.js の onAuthStateChange で一元管理するため削除
            } else {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                showToast('確認メールを送信しました', 'info');
            }

            // ログイン成功後、ダッシュボードへ
            window.location.hash = '#dashboard';

        } catch (err) {
            console.error(err);
            showToast(err.message || '認証に失敗しました', 'error');
        } finally {
            submitBtn.disabled = false;
        }
    });
}
