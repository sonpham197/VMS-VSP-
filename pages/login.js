import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';
import Head from 'next/head';
import { Anchor, ShieldAlert, Loader2 } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    const session = localStorage.getItem('vms_session');
    if (session) {
      router.push('/');
    }
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Query Customer table
      const { data, error } = await supabase
        .from('Customer')
        .select('*')
        .eq('name', username)
        .eq('pasword', password)
        .single(); // we expect strictly 1 user

      if (error || !data) {
        setError('Tên đăng nhập hoặc mật khẩu không chính xác.');
      } else {
        // Success
        localStorage.setItem('vms_session', JSON.stringify({
          id: data.id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          avatar_url: data.avatar_url || null,
        }));
        router.push('/');
      }
    } catch (err) {
      setError('Lỗi kết nối cơ sở dữ liệu. Vui lòng thử lại.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center relative overflow-hidden font-sans">
      <Head>
        <title>Đăng Nhập | VMS Marine</title>
      </Head>

      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-600 rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md p-8 md:p-10 bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 shadow-2xl rounded-3xl">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-cyan-500/20 text-cyan-400 rounded-2xl flex items-center justify-center mb-4 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
             <Anchor size={36} className="drop-shadow-md" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">VMS Portal</h1>
          <p className="text-slate-400 mt-2 text-sm text-center">Hệ thống Giám sát Hành trình Hàng hải</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center text-sm">
              <ShieldAlert size={18} className="mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tên đăng nhập</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all placeholder-slate-500"
              placeholder="Nhập tên tài khoản (vd: Admin)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Mật khẩu</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all placeholder-slate-500"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={20} />
                Đang xác thực...
              </>
            ) : (
              'Đăng Nhập Hệ Thống'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-500">
          <p>© 2026 VMS Marine. All rights reserved.</p>
          <p className="mt-1">Truy cập bộ điều khiển trung tâm được bảo mật cao.</p>
        </div>
      </div>
    </div>
  );
}
