import { store } from './store.js';

class Router {
    constructor() {
        this.routes = {};
        this.rootElement = document.getElementById('page-content');

        // ハッシュ変更時のイベントリスナー
        window.addEventListener('hashchange', () => this.handleRoute());
    }

    addRoute(path, renderFunction, onMount = null) {
        this.routes[path] = { render: renderFunction, onMount };
    }

    navigate(path) {
        window.location.hash = path;
    }

    handleRoute() {
        // 現在のパスを取得（先頭の '#' と '/' を削除して正規化）
        let path = window.location.hash.slice(1);

        if (!path || path === '/') {
            path = 'dashboard';
            // URLを更新して履歴に残す
            window.history.replaceState(null, null, '#dashboard');
        }

        // クエリストリング等のパース（簡易）
        const pathParts = path.split('?');
        const routePath = pathParts[0];

        // 認証ガード: ログインしていない場合は強制的にauthへ
        const isAuthPage = routePath.includes('auth');
        if (!store.state.user && !isAuthPage) {
            window.location.hash = '#auth';
            return;
        }

        const route = this.routes[routePath] || this.routes['dashboard'];

        // アクティブなルートをStoreに保存
        store.setState({ currentRoute: routePath });

        // 画面のクリアと描画
        this.rootElement.innerHTML = '';
        this.rootElement.appendChild(route.render());

        // マウント時のコールバック（グラフ初期化等）
        if (route.onMount) {
            // DOMマウント完了を待つために一瞬遅延させる
            setTimeout(() => route.onMount(), 0);
        }

        // トップにスクロール
        window.scrollTo(0, 0);

        // サイドバーのアクティブ状態を更新
        this.updateSidebarActiveState(routePath);
    }

    updateSidebarActiveState(path) {
        const links = document.querySelectorAll('.sidebar-link');
        links.forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('href');
            if (href === `#${path}` || (path === '' && href === '#dashboard')) {
                link.classList.add('active');
            }
        });
    }

    init() {
        this.handleRoute();
    }
}

export const router = new Router();
