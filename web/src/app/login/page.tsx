'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { apiFetch } from '../../lib/api';
import { Logo } from '../../components/Logo';

const ArrowLeft = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const Eye = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOff = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);
type StaffForm = { phone: string; password: string };
type OtpForm = { otp: string; newPassword: string };
type PatientMember = { _id: string };

export default function LoginPage() {
  const router = useRouter();
  const { login, requestPasswordResetOtp, confirmPasswordReset } = useAuth();
  const [otpSent, setOtpSent] = useState(false);
  const [mobile, setMobile] = useState('');
  const [otpSeconds, setOtpSeconds] = useState(60);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const otpInputRef = useRef<HTMLInputElement[]>([]);

  const staffForm = useForm<StaffForm>({ defaultValues: { phone: '', password: '' } });
  const otpForm = useForm<OtpForm>({ defaultValues: { otp: '', newPassword: '' } });

  const otpValue = otpForm.watch('otp') || '';
  const otpDigits = useMemo(() => {
    const clean = otpValue.replace(/\D/g, '').slice(0, 6);
    return [0, 1, 2, 3, 4, 5].map((i) => clean[i] || '');
  }, [otpValue]);

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const chars = otpDigits.slice();
    chars[index] = digit;
    otpForm.setValue('otp', chars.join(''));
    if (digit && index < 5) {
      otpInputRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRef.current[index - 1]?.focus();
    }
  };

  const sendOtp = async (phone: string) => {
    const res = await requestPasswordResetOtp(phone);
    setOtpSent(true);
    setOtpSeconds(60);
    setDevOtp(res.otp ?? null);
    otpForm.setValue('otp', '');
    otpForm.setValue('newPassword', '');
    setTimeout(() => otpInputRef.current[0]?.focus(), 50);
  };

  const onSubmitStaff = staffForm.handleSubmit(async (data) => {
    const phone = data.phone.trim();
    const user = await login(phone, data.password);
    if (user.role === 'patient') {
      const members = await apiFetch<PatientMember[]>('/patients/my');
      if ((members || []).length === 0) {
        router.push('/welcome');
        return;
      }
      router.push('/home');
      return;
    }
    router.push('/dashboard');
  });

  const onSubmitOtp = otpForm.handleSubmit(async (data) => {
    await confirmPasswordReset(mobile, data.otp.trim(), data.newPassword);
    setOtpSent(false);
    setDevOtp(null);
    otpForm.setValue('otp', '');
    otpForm.setValue('newPassword', '');
  });

  const handleResendOtp = async () => {
    if (otpSeconds > 0) return;
    if (!mobile) return;
    await sendOtp(mobile);
  };

  useEffect(() => {
    if (!otpSent) return;
    const timer = setInterval(() => {
      setOtpSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpSent]);

  if (otpSent) {
    return (
      <main className="min-h-screen bg-[#fafafa] flex flex-col text-zinc-900 px-6 font-sans relative">
        <header className="pt-14 pb-8">
          <button
            onClick={() => setOtpSent(false)}
            className="w-10 h-10 rounded-full border border-gray-200 bg-white shadow-sm flex items-center justify-center transition-transform active:scale-95 text-gray-700"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 flex flex-col">
          <div className="text-center mb-10">
            <h1 className="text-2xl font-semibold mb-3 tracking-tight">Verify Code</h1>
            <p className="text-gray-500 text-[15px] leading-relaxed max-w-[260px] mx-auto">
              Please enter the code we just sent to phone <span className="text-[#0254b7] break-all block mt-1">+91 {mobile}</span>
            </p>
          </div>

          <div className="flex justify-center gap-2 mb-10">
            {otpDigits.map((digit, index) => (
              <input
                key={index}
                className="w-12 h-14 border border-gray-200 rounded-xl text-center text-xl font-semibold text-gray-900 bg-white focus:outline-none focus:border-[#0254b7] focus:ring-1 focus:ring-[#0254b7]/30 transition-all shadow-sm"
                value={digit}
                placeholder="-"
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                ref={(el) => {
                  if (el) otpInputRef.current[index] = el;
                }}
              />
            ))}
          </div>

          <div className="text-center mb-8">
            <p className="text-[13px] text-gray-500 mb-2">Didn't receive OTP?</p>
            <button
              onClick={handleResendOtp}
              disabled={otpSeconds > 0}
              className={`text-[15px] font-medium underline underline-offset-4 transition-colors ${otpSeconds === 0 ? 'text-[#0254b7] hover:text-[#02479d]' : 'text-gray-400 cursor-not-allowed no-underline'
                }`}
            >
              {otpSeconds > 0 ? `Resend code in ${otpSeconds}s` : 'Resend code'}
            </button>
          </div>

          <button
            onClick={onSubmitOtp}
            disabled={otpValue.replace(/\D/g, '').length < 6 || (otpForm.watch('newPassword') || '').length < 6}
            className={`w-full rounded-full py-4 text-[17px] font-semibold transition-all ${otpValue.replace(/\D/g, '').length < 6
              ? 'bg-blue-300 text-white/90 cursor-not-allowed shadow-none'
              : 'bg-[#0254b7] text-white shadow-lg shadow-blue-500/25 active:scale-[0.98]'
              }`}
          >
            Verify
          </button>

          <div className="mt-6 flex flex-col gap-2 relative">
            <label className="text-[14px] font-medium text-gray-700 ml-1">New Password</label>
            <div className="relative flex items-center w-full bg-white border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#0254b7] focus-within:ring-1 focus-within:ring-[#0254b7]/30 transition-all shadow-sm">
              <input
                className="w-full bg-transparent pl-4 pr-12 py-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400"
                type={showPassword ? 'text' : 'password'}
                placeholder="****************"
                {...otpForm.register('newPassword', { required: true, minLength: 6 })}
              />
              <button
                type="button"
                className="absolute right-4 text-gray-400 hover:text-gray-600 focus:outline-none"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-[18px] h-[18px]" strokeWidth={2.5} /> : <Eye className="w-[18px] h-[18px]" strokeWidth={2.5} />}
              </button>
            </div>
          </div>

          {process.env.NODE_ENV !== 'production' && devOtp ? (
            <div className="mt-8 text-center text-[13px] text-gray-400">
              Dev OTP: <span className="font-semibold text-gray-700">{devOtp}</span>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafafa] flex flex-col text-zinc-900 px-6 font-sans">
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full pt-10 pb-8">
        <div className="flex flex-col items-center mb-10 text-center">
          <Logo size={160} className="mb-5" />
          <p className="text-[15px] text-gray-500">
          </p>
        </div>

        <form onSubmit={onSubmitStaff} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-medium text-gray-700 ml-1">Phone Number</label>
            <div className="flex items-center w-full bg-white border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#0254b7] focus-within:ring-1 focus-within:ring-[#0254b7]/30 transition-all shadow-sm">
              <div className="pl-4 pr-3 py-4 text-[15px] text-gray-500 font-medium select-none bg-gray-50/50 border-r border-gray-100">
                +91
              </div>
              <input
                className="w-full bg-transparent px-4 py-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400"
                placeholder="Enter your phone number"
                type="tel"
                inputMode="tel"
                {...staffForm.register('phone', { required: true, pattern: /^[0-9]{10}$/ })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 relative">
            <label className="text-[14px] font-medium text-gray-700 ml-1">Password</label>
            <div className="relative flex items-center w-full bg-white border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#0254b7] focus-within:ring-1 focus-within:ring-[#0254b7]/30 transition-all shadow-sm">
              <input
                className="w-full bg-transparent pl-4 pr-12 py-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400"
                type={showPassword ? 'text' : 'password'}
                placeholder="****************"
                {...staffForm.register('password', { required: true, minLength: 6 })}
              />
              <button
                type="button"
                className="absolute right-4 text-gray-400 hover:text-gray-600 focus:outline-none"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-[18px] h-[18px]" strokeWidth={2.5} /> : <Eye className="w-[18px] h-[18px]" strokeWidth={2.5} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end mt-[-4px]">
            <button
              type="button"
              className="text-[#0254b7] text-[13.5px] font-medium hover:underline underline-offset-2"
              onClick={async () => {
                const phone = staffForm.getValues('phone').trim();
                if (!phone) return;
                setMobile(phone);
                await sendOtp(phone);
              }}
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            className="w-full bg-[#0254b7] text-white rounded-full py-4 text-[17px] font-semibold mt-4 shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all"
          >
            Sign In
          </button>
        </form>

        <div className="mt-8 text-center text-[14px] text-gray-600 pt-4">
          <button
            type="button"
            className="text-[#0254b7] font-semibold hover:underline underline-offset-2"
            onClick={() => router.push('/register')}
          >
            New patient? Register
          </button>
        </div>
      </div>
    </main>
  );
}
