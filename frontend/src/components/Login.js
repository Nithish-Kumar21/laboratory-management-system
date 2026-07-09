import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  TbFlask, TbSettings, TbBrandLinkedin, TbBrandX,
  TbBrandYoutube, TbBrandInstagram, TbWorld, TbMail
} from 'react-icons/tb';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const socialLinks = [
  { icon: TbBrandLinkedin, label: 'LinkedIn' },
  { icon: TbBrandX, label: 'Twitter / X' },
  { icon: TbBrandYoutube, label: 'YouTube' },
  { icon: TbBrandInstagram, label: 'Instagram' },
  { icon: TbWorld, label: 'Website' },
  { icon: TbWorld, label: 'Website' },
];

const mobileSocialIcons = [
  { icon: TbBrandLinkedin, label: 'LinkedIn' },
  { icon: TbBrandX, label: 'Twitter / X' },
  { icon: TbBrandYoutube, label: 'YouTube' },
  { icon: TbBrandInstagram, label: 'Instagram' },
  { icon: TbWorld, label: 'Website' },
  { icon: TbMail, label: 'Email' },
];

const FlaskWatermark = () => (
  <svg viewBox="0 0 100 140" className="w-40 h-56" fill="none" stroke="white" strokeWidth="1.2" opacity="0.12">
    <path d="M40 15 L40 55 L10 110 Q5 122 15 128 L85 128 Q95 122 90 110 L60 55 L60 15" />
    <line x1="32" y1="8" x2="68" y2="8" />
    <line x1="36" y1="15" x2="64" y2="15" />
    <line x1="40" y1="22" x2="60" y2="22" />
    <ellipse cx="50" cy="125" rx="40" ry="6" />
    <circle cx="30" cy="95" r="4" />
    <circle cx="50" cy="85" r="6" />
    <circle cx="40" cy="100" r="3" />
    <circle cx="60" cy="92" r="5" />
    <circle cx="70" cy="100" r="3" />
  </svg>
);

const SocialIconRow = ({ icons, size = 20, containerClass = '' }) => (
  <div className={`flex items-center justify-center gap-3 md:gap-4 ${containerClass}`}>
    {icons.map(({ icon: Icon, label }) => (
      <button
        key={label}
        type="button"
        aria-label={label}
        className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 transition-colors shadow-sm"
      >
        <Icon className="text-[#1A3C6E]" size={size} />
      </button>
    ))}
  </div>
);

const Login = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(employeeId, password);
      if (result.first_login) {
        navigate('/change-password');
      } else if (result.password_must_change) {
        navigate('/change-password', { state: { forced: true } });
      } else {
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid Employee ID or password');
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      {error && (
        <div className="bg-red-500/20 border border-red-400/50 text-red-200 px-4 py-3 rounded-lg text-sm text-center">
          {error}
        </div>
      )}
      <input
        type="text"
        value={employeeId}
        onChange={(e) => setEmployeeId(e.target.value)}
        required
        disabled={loading}
        placeholder="Employee ID"
        aria-label="Employee ID"
        className="w-full h-11 bg-[#EDEFF2] rounded-lg px-4 text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#4A90D9] disabled:opacity-60 disabled:cursor-not-allowed"
      />
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          placeholder="Password"
          aria-label="Password"
          className="w-full h-11 bg-[#EDEFF2] rounded-lg pl-4 pr-10 text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#4A90D9] disabled:opacity-60 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          disabled={loading}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 disabled:opacity-60"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <p style={{ textAlign: 'right', margin: 0 }}>
        <Link
          to="/forgot-password"
          style={{ color: '#93C5FD', fontSize: '0.8rem', textDecoration: 'none' }}
        >
          Forgot Password?
        </Link>
      </p>
      <button
        type="submit"
        disabled={loading}
        className="w-full h-11 bg-[#4A90D9] text-white font-bold text-sm rounded-lg hover:bg-[#3A7BC8] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'Logging in...' : 'Log In'}
      </button>
    </form>
  );

  return (
    <>
      <div className="md:hidden min-h-screen bg-[#1A3C6E] flex flex-col">
        <div className="flex justify-end p-4">
          <TbSettings className="text-white/80" size={22} />
        </div>
        <div className="flex-1 flex flex-col items-center px-6 pb-0">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-4 overflow-hidden">
            <img
              src="/gnc_logo.png"
              alt="College Logo"
              className="w-16 h-16 rounded-full object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <h1 className="text-white text-xl font-bold text-center leading-tight">
            GURU NANAK COLLEGE<br />
              <span className="text-base font-medium opacity-80">(AUTONOMOUS), Chennai</span>
            </h1>
          <div className="mt-2 text-center text-xs text-[#C9D6E8] space-y-0.5 leading-relaxed">
            <p>A Sikh Minority Institution</p>
          </div>
          <div className="w-full max-w-[320px] mt-6">
            {formContent}
          </div>
          <div className="mt-6 mb-4">
            <SocialIconRow icons={mobileSocialIcons} size={16} />
          </div>
        </div>
        <div className="relative h-[35vh] min-h-[220px] w-full mt-auto">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: 'url("/gnc_bg.jpg")' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1A3C6E] via-[#1A3C6E]/60 to-transparent" />
          <div className="absolute bottom-4 inset-x-0 text-center px-4">
            <p className="text-white/60 text-[11px]">
              Copyright &copy; Guru Nanak College (AUTONOMOUS), Chennai
            </p>
          </div>
        </div>
      </div>

      <div className="hidden md:flex h-screen w-screen overflow-hidden">
        <div className="w-[30%] bg-[#1A3C6E] relative flex flex-col justify-between px-8 py-10">
          <div className="flex items-start gap-5">
            <div className="w-[70px] h-[70px] bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
              <TbFlask className="text-[#1A3C6E]" size={34} />
            </div>
            <div className="font-bold text-white uppercase text-lg leading-tight tracking-wide pt-1">
              LABORATORY<br />MANAGEMENT<br />SYSTEM
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <FlaskWatermark />
          </div>
          <div className="relative z-10">
            <SocialIconRow icons={socialLinks} size={18} />
          </div>
          <div className="absolute right-0 top-8 bottom-8 w-px bg-white/15" />
        </div>
        <div className="w-[70%] relative h-screen overflow-hidden bg-[#1A3C6E]">
          <div
            className="absolute inset-0 bg-[#F4C9D6] z-[1]"
            style={{ clipPath: 'polygon(calc(78% - 8px) 0, 100% 0, 100% 100%, calc(42% - 8px) 100%)' }}
          />
          <div
            className="absolute inset-0 bg-cover bg-center z-[2]"
            style={{
              backgroundImage: 'url("/gnc_bg.jpg")',
              clipPath: 'polygon(78% 0, 100% 0, 100% 100%, 42% 100%)'
            }}
          />
          <div className="relative z-[3] flex flex-col items-center pt-10 h-full overflow-y-auto w-[55%] ml-[8%] pr-12">
            <div className="w-20 h-20 rounded-full bg-white/15 flex items-center justify-center overflow-hidden ring-2 ring-white/20">
              <img
                src="/gnc_logo.png"
                alt="College Logo"
                className="w-[72px] h-[72px] rounded-full object-contain"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
            <h1 className="text-white text-[22px] font-bold text-center leading-tight mt-4">
              GURU NANAK COLLEGE<br />
              <span className="text-lg font-medium opacity-75">(AUTONOMOUS), Chennai</span>
            </h1>
            <div className="mt-3 text-center text-sm text-[#C9D6E8] space-y-0.5 leading-relaxed">
              <p>A Sikh Minority Institution</p>
            </div>
            <div className="w-full max-w-[320px] mt-7">
              {formContent}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
