'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Logo } from '../components/Logo';

const ArrowLeft = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ArrowRight = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const slides = [
  {
    title: (
      <>
        Effortless <span className="text-[#0254b7]">Appointment</span>
        <br />
        Booking
      </>
    ),
    body: 'Manage your time efficiently with our simple and intuitive booking system.',
    image: '/onboarding/booking.png',
  },
  {
    title: (
      <>
        <span className="text-[#0254b7]">Learn About</span> Your
        <br />
        Doctors
      </>
    ),
    body: 'Get to know your healthcare providers and their specialties before your visit.',
    image: '/onboarding/doctors.png',
  },
  {
    title: (
      <>
        Secure <span className="text-[#0254b7]">Health Records</span>
        <br />
        Management
      </>
    ),
    body: 'Access and manage your medical history securely from anywhere, at any time.',
    image: '/onboarding/records.png',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const skipSplash = searchParams.get('skipSplash') === '1';
  const [phase, setPhase] = useState<'splash' | 'onboarding'>(skipSplash ? 'onboarding' : 'splash');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (skipSplash) return;
    const timer = setTimeout(() => setPhase('onboarding'), 1600);
    return () => clearTimeout(timer);
  }, [skipSplash]);

  if (phase === 'splash') {
    return (
      <main className="min-h-screen relative overflow-hidden bg-gradient-to-b from-[#0254b7] via-[#0157D8] to-[#013A9C] flex flex-col items-center justify-center text-white">
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col items-center">
          <Logo size={200} variant="white" priority fetchPriority="high" />
          <div className="mt-7 h-10 w-10 rounded-full border-4 border-white/25 border-t-white animate-spin" />
        </div>
      </main>
    );
  }

  const handleNext = () => {
    if (index < slides.length - 1) {
      setIndex(index + 1);
    } else {
      router.push('/login');
    }
  };

  const handlePrev = () => {
    if (index > 0) {
      setIndex(index - 1);
    }
  };

  const currentSlide = slides[index];

  return (
    <main className="min-h-screen bg-white flex flex-col relative text-zinc-900">
      <header className="px-6 pt-14 pb-4 flex justify-end absolute top-0 w-full z-10">
        <button
          onClick={() => router.push('/login')}
          className="text-[#0254b7] font-medium text-sm active:scale-95 transition-transform"
        >
          Skip
        </button>
      </header>

      <div className="flex-1 flex flex-col pt-24 pb-12 px-8">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="relative w-full max-w-[320px] aspect-square mb-8">
            <Image
              src={currentSlide.image}
              alt="Onboarding illustration"
              fill
              className="object-contain"
              priority
              fetchPriority="high"
            />
          </div>

          <div className="text-center w-full max-w-sm mt-4">
            <h1 className="text-[26px] leading-[1.2] font-semibold tracking-tight">
              {currentSlide.title}
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-zinc-500">
              {currentSlide.body}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between w-full max-w-sm mx-auto mt-auto pt-8">
          <button
            onClick={handlePrev}
            className={`w-12 h-12 rounded-full border border-[#0254b7] flex items-center justify-center text-[#0254b7] transition-all hover:bg-blue-50 active:scale-95 ${index === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
            aria-label="Previous slide"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>

          <div className="flex items-center gap-2">
            {slides.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${i === index ? 'w-2 bg-[#0254b7]' : 'w-2 bg-blue-100'
                  }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="w-12 h-12 rounded-full bg-[#0254b7] flex items-center justify-center text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-600 active:scale-95"
            aria-label="Next slide"
          >
            <ArrowRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </main>
  );
}
