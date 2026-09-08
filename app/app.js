// Supabaseの設定
const SUPABASE_URL = 'https://hwadprvpvxtbiiuvpsso.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ydrTup3LoNdul7KeXWVwwg_raIcSjFy';

// Supabaseクライアント
const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// 画面要素
const loginScreen = document.getElementById('login-screen');
const homeScreen = document.getElementById('home-screen');

const loginForm = document.getElementById('login-form');
const userIdInput = document.getElementById('user-id');
const passwordInput = document.getElementById('password');

const loginMessage = document.getElementById('login-message');
const welcomeMessage = document.getElementById('welcome-message');
const logoutButton = document.getElementById('logout-button');


// ログイン処理
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const userId = userIdInput.value.trim();
  const password = passwordInput.value;

  loginMessage.textContent = 'ログインしています…';

  // 今は接続確認用
  // 実際のログイン処理は次のステップで作ります
  console.log('ログイン情報:', userId);

  loginMessage.textContent =
    'Supabaseへの接続準備ができています。';

  passwordInput.value = '';
});


// ログアウト
logoutButton.addEventListener('click', async () => {
  await supabase.auth.signOut();

  homeScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');

  welcomeMessage.textContent = '';
});