"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Scissors,
  Clock,
  MapPin,
  Phone,
  Mail,
  Globe,
  Star,
  ChevronRight,
  Calendar,
  CheckCircle2,
  Sparkles,
  Heart,
  ArrowRight,
  ChevronLeft,
  AlertCircle,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
  description: string | null;
  category: { id: string; name: string };
};

type TimeSlot = {
  time: string;
  label: string;
  available: boolean;
};

type SlotsResponse = {
  date: string;
  dayName: string;
  closed: boolean;
  openTime?: string;
  closeTime?: string;
  serviceDuration?: number;
  slots: TimeSlot[];
};

const heroImages = [
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80",
  "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80",
  "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=800&q=80",
];

// Map category names to beautiful representative Unsplash images
const categoryImages: Record<string, string> = {
  "nails": "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&q=80",
  "nail": "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&q=80",
  "hair": "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80",
  "haircut": "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80",
  "hairstyle": "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80",
  "hair styling": "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80",
  "hair care": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80",
  "coloring": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80",
  "color": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80",
  "makeup": "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=600&q=80",
  "make up": "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=600&q=80",
  "facial": "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80",
  "face": "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80",
  "skin": "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80",
  "skincare": "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80",
  "spa": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80",
  "massage": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80",
  "braids": "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&q=80",
  "braiding": "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&q=80",
  "waxing": "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=600&q=80",
  "eyebrow": "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=600&q=80",
  "lash": "https://images.unsplash.com/photo-1583001931096-959e9a1a6223?w=600&q=80",
  "eyelash": "https://images.unsplash.com/photo-1583001931096-959e9a1a6223?w=600&q=80",
  "extensions": "https://images.unsplash.com/photo-1583001931096-959e9a1a6223?w=600&q=80",
  "barber": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80",
  "beard": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80",
  "shave": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80",
  "treatment": "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=600&q=80",
  "pedicure": "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=600&q=80",
  "manicure": "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&q=80",
};

const defaultServiceImage = "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=600&q=80";

function getCategoryImage(categoryName: string): string {
  const lower = categoryName.toLowerCase();
  // exact match first
  if (categoryImages[lower]) return categoryImages[lower];
  // partial match
  for (const [key, url] of Object.entries(categoryImages)) {
    if (lower.includes(key) || key.includes(lower)) return url;
  }
  return defaultServiceImage;
}

const galleryImages = [
  { src: "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=600&q=80", alt: "Hair styling" },
  { src: "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&q=80", alt: "Beauty treatment" },
  { src: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=600&q=80", alt: "Salon interior" },
  { src: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=600&q=80", alt: "Happy client" },
];

export function PublicWebsite() {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [booking, setBooking] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    serviceId: "",
    preferredDate: "",
    preferredTime: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [slotsData, setSlotsData] = useState<SlotsResponse | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const bookingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/public/services")
      .then((r) => r.json())
      .then(setServices)
      .catch(() => {});
  }, []);

  const grouped = services.reduce<Record<string, ServiceOption[]>>((acc, s) => {
    const cat = s.category.name;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const fetchSlots = useCallback(async (date: string, serviceId: string) => {
    if (!date || !serviceId) return;
    setLoadingSlots(true);
    setSlotsData(null);
    try {
      const res = await fetch(`/api/public/slots?date=${date}&serviceId=${serviceId}`);
      if (!res.ok) throw new Error();
      const data: SlotsResponse = await res.json();
      setSlotsData(data);
    } catch {
      toast.error("Failed to load available times");
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  async function handleBook() {
    if (!booking.firstName || !booking.phone || !booking.serviceId || !booking.preferredDate || !booking.preferredTime) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(booking),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Booking failed");
      }
      setBooked(true);
      toast.success("Appointment request sent!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to book");
    } finally {
      setSubmitting(false);
    }
  }

  function scrollToBooking() {
    setMobileMenuOpen(false);
    bookingRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function resetBooking() {
    setBooked(false);
    setBookingStep(1);
    setBooking({ firstName: "", lastName: "", phone: "", email: "", serviceId: "", preferredDate: "", preferredTime: "", notes: "" });
    setSlotsData(null);
  }

  const today = new Date();
  const minDate = today.toISOString().split("T")[0];
  const maxDateObj = new Date();
  maxDateObj.setDate(maxDateObj.getDate() + 30);
  const maxDate = maxDateObj.toISOString().split("T")[0];

  const selectedService = services.find((s) => s.id === booking.serviceId);

  const quickDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      date: d.toISOString().split("T")[0],
      dayShort: d.toLocaleDateString("en", { weekday: "short" }),
      dayNum: d.getDate(),
      monthShort: d.toLocaleDateString("en", { month: "short" }),
      isToday: i === 0,
    };
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-pink-100/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 shadow-lg shadow-pink-200/50">
              <Scissors className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg sm:text-xl font-black tracking-tight bg-gradient-to-r from-pink-600 to-rose-500 bg-clip-text text-transparent">
              BERCHI
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#services" className="hover:text-pink-600 transition-colors">Services</a>
            <a href="#gallery" className="hover:text-pink-600 transition-colors">Gallery</a>
            <a href="#about" className="hover:text-pink-600 transition-colors">About</a>
            <a href="#contact" className="hover:text-pink-600 transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button onClick={scrollToBooking} className="rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-lg shadow-pink-200/40 text-xs sm:text-sm px-3 sm:px-5 h-8 sm:h-9">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
              Book Now
            </Button>
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-pink-600 text-sm">
                Staff Login
              </Button>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-lg hover:bg-pink-50 text-gray-600"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-pink-100 px-4 py-3 space-y-1 animate-in slide-in-from-top-2">
            <a href="#services" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-pink-50 hover:text-pink-600">Services</a>
            <a href="#gallery" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-pink-50 hover:text-pink-600">Gallery</a>
            <a href="#about" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-pink-50 hover:text-pink-600">About</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-pink-50 hover:text-pink-600">Contact</a>
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 px-3 rounded-xl text-sm font-medium text-gray-500 hover:bg-pink-50">Staff Login</Link>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-50 via-rose-50/50 to-white" />
        <div className="absolute top-10 right-5 sm:top-20 sm:right-10 w-40 h-40 sm:w-72 sm:h-72 bg-pink-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-5 left-5 sm:bottom-10 sm:left-10 w-52 h-52 sm:w-96 sm:h-96 bg-rose-200/20 rounded-full blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 md:py-28 lg:py-36">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-pink-100/80 border border-pink-200/50 text-xs sm:text-sm font-semibold text-pink-700 mb-4 sm:mb-6">
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Welcome to Berchi Salon
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]">
                Where Beauty
                <span className="block bg-gradient-to-r from-pink-600 via-rose-500 to-pink-500 bg-clip-text text-transparent">
                  Meets Elegance
                </span>
              </h1>
              <p className="mt-4 sm:mt-6 text-sm sm:text-base lg:text-lg text-gray-600 leading-relaxed max-w-lg">
                Experience premium hair care, styling, and beauty treatments in a warm, welcoming atmosphere.
                Book your appointment today and let our expert stylists transform your look.
              </p>
              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <Button onClick={scrollToBooking} size="lg" className="rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-xl shadow-pink-300/30 text-sm sm:text-base px-6 sm:px-8 h-12 sm:h-13">
                  Book Appointment
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <a href="#services">
                  <Button variant="outline" size="lg" className="rounded-full border-pink-200 text-pink-700 hover:bg-pink-50 h-12 sm:h-13 px-6 sm:px-8 w-full">
                    View Services
                  </Button>
                </a>
              </div>
              <div className="mt-6 sm:mt-10 flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-gray-500">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="flex -space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <span className="font-medium text-gray-700">5.0</span>
                  <span className="hidden xs:inline">from 200+ reviews</span>
                </div>
                <div className="h-4 w-px bg-gray-200" />
                <div className="flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-pink-400 fill-pink-400" />
                  <span>1000+ happy clients</span>
                </div>
              </div>
            </div>
            {/* Hero images grid */}
            <div className="hidden lg:grid grid-cols-2 gap-3">
              <div className="space-y-3">
                <div className="rounded-2xl overflow-hidden shadow-2xl shadow-pink-200/30 aspect-[3/4]">
                  <Image src={heroImages[0]} alt="Salon styling" width={400} height={533} className="w-full h-full object-cover" unoptimized />
                </div>
              </div>
              <div className="space-y-3 pt-8">
                <div className="rounded-2xl overflow-hidden shadow-2xl shadow-pink-200/30 aspect-square">
                  <Image src={heroImages[1]} alt="Beauty treatment" width={400} height={400} className="w-full h-full object-cover" unoptimized />
                </div>
                <div className="rounded-2xl overflow-hidden shadow-xl shadow-pink-200/20 aspect-[4/3]">
                  <Image src={heroImages[2]} alt="Hair care" width={400} height={300} className="w-full h-full object-cover" unoptimized />
                </div>
              </div>
            </div>
            {/* Mobile hero image */}
            <div className="lg:hidden rounded-2xl overflow-hidden shadow-2xl shadow-pink-200/30 aspect-video max-w-md mx-auto w-full">
              <Image src={heroImages[0]} alt="Salon styling" width={800} height={450} className="w-full h-full object-cover" unoptimized />
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="relative py-16 sm:py-24 lg:py-32 bg-[#0f0f0f] overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-pink-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-rose-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-10 sm:mb-16">
            <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] uppercase text-pink-400/90 mb-3 sm:mb-4">
              What We Do Best
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1]">
              Our Services
            </h2>
            <div className="mt-4 sm:mt-5 w-12 h-[2px] bg-pink-500 mx-auto rounded-full" />
          </div>

          {Object.entries(grouped).length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-pink-500/20 border-t-pink-500 animate-spin" />
              <p className="text-sm text-white/30">Loading services...</p>
            </div>
          ) : (() => {
            const categories = Object.keys(grouped);
            const currentCat = activeCategory || categories[0] || "";
            const currentItems = grouped[currentCat] || [];
            const catImage = getCategoryImage(currentCat);

            return (
              <>
                {/* Category Tabs */}
                <div className="flex justify-center mb-10 sm:mb-14">
                  <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 px-1 max-w-full scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                    {categories.map((cat) => {
                      const isActive = cat === currentCat;
                      return (
                        <button
                          key={cat}
                          onClick={() => setActiveCategory(cat)}
                          className={`relative shrink-0 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
                            isActive
                              ? "bg-white text-[#0f0f0f] shadow-lg shadow-white/10"
                              : "text-white/50 hover:text-white/80 hover:bg-white/5"
                          }`}
                        >
                          {cat}
                          {isActive && (
                            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-pink-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Featured Category Banner */}
                <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden mb-8 sm:mb-12 group">
                  <div className="aspect-[16/9] sm:aspect-[21/9] lg:aspect-[3/1]">
                    <Image
                      src={catImage}
                      alt={currentCat}
                      width={1200}
                      height={400}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      unoptimized
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 lg:p-10">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-pink-300 text-[10px] sm:text-xs font-semibold tracking-[0.2em] uppercase mb-1.5 sm:mb-2">Category</p>
                        <h3 className="text-white text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">{currentCat}</h3>
                        <p className="text-white/60 text-xs sm:text-sm mt-1 sm:mt-2 max-w-md">
                          {currentItems.length} premium service{currentItems.length !== 1 ? "s" : ""} crafted for your beauty
                        </p>
                      </div>
                      <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
                        <Sparkles className="h-3.5 w-3.5 text-pink-300" />
                        <span className="text-white/80 text-xs font-medium">{currentItems.length} Services</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Service Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {currentItems.map((service, idx) => (
                    <div
                      key={service.id}
                      className="group/card relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 sm:p-6 hover:bg-white/[0.06] hover:border-pink-500/20 transition-all duration-500"
                      style={{ animationDelay: `${idx * 60}ms` }}
                    >
                      {/* Top accent line */}
                      <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-pink-500/30 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />

                      <div className="flex items-start gap-4">
                        {/* Service image thumbnail */}
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/10 group-hover/card:ring-pink-500/20 transition-all duration-500">
                          <Image
                            src={catImage}
                            alt={service.name}
                            width={128}
                            height={128}
                            className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-700"
                            unoptimized
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-bold text-sm sm:text-base leading-snug group-hover/card:text-pink-200 transition-colors duration-300">
                            {service.name}
                          </h4>
                          {service.description && (
                            <p className="text-white/30 text-xs sm:text-[13px] mt-1.5 line-clamp-2 leading-relaxed group-hover/card:text-white/40 transition-colors">
                              {service.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Bottom row with duration */}
                      <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-white/25 group-hover/card:text-white/40 transition-colors">
                          <Clock className="h-3 w-3" />
                          <span className="text-[11px] sm:text-xs font-medium">{service.durationMinutes} minutes</span>
                        </div>
                        <button
                          onClick={scrollToBooking}
                          className="text-[10px] sm:text-[11px] font-semibold text-pink-400/70 hover:text-pink-300 transition-colors tracking-wide uppercase flex items-center gap-1"
                        >
                          Book
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom CTA */}
                <div className="mt-10 sm:mt-14 text-center">
                  <button
                    onClick={scrollToBooking}
                    className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-full bg-white text-[#0f0f0f] font-bold text-sm sm:text-base hover:bg-pink-50 hover:shadow-lg hover:shadow-pink-500/10 transition-all duration-300"
                  >
                    <Calendar className="h-4 w-4" />
                    Book an Appointment
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="py-12 sm:py-16 lg:py-20 bg-gradient-to-b from-white via-pink-50/30 to-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-100/60 border border-pink-200/50 text-xs font-semibold text-pink-600 uppercase tracking-widest mb-3 sm:mb-4">
              <Heart className="h-3 w-3" /> Gallery
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">Our Work Speaks</h2>
            <p className="mt-2 text-sm sm:text-base text-gray-500">A glimpse of the beauty we create every day</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {galleryImages.map((img, i) => (
              <div key={i} className={`rounded-2xl overflow-hidden shadow-lg shadow-pink-100/30 group ${i === 0 ? "md:row-span-2 aspect-[3/4] md:aspect-auto" : "aspect-square"}`}>
                <Image src={img.src} alt={img.alt} width={600} height={600} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Booking Section */}
      <section ref={bookingRef} id="booking" className="py-12 sm:py-16 lg:py-20 bg-gradient-to-b from-pink-50/50 to-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6 sm:mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-100/60 border border-pink-200/50 text-xs font-semibold text-pink-600 uppercase tracking-widest mb-3 sm:mb-4">
              <Calendar className="h-3 w-3" /> Book Online
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">
              Book Your Appointment
            </h2>
            <p className="mt-2 sm:mt-3 text-sm sm:text-base text-gray-500 max-w-md mx-auto">
              Choose your service, pick a date &amp; time, and we&apos;ll confirm your spot.
            </p>
          </div>

          {booked ? (
            <Card className="rounded-2xl border-emerald-200 overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-teal-400" />
              <CardContent className="py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-emerald-800">Appointment Booked!</h3>
                <p className="mt-2 text-gray-500 max-w-sm mx-auto">
                  Thank you! Our team will review and confirm your appointment.
                  We&apos;ll call you if any changes are needed.
                </p>
                <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-sm max-w-xs mx-auto">
                  <p className="font-semibold text-emerald-800">{selectedService?.name}</p>
                  <p className="text-emerald-600 mt-1">
                    {booking.preferredDate && new Date(booking.preferredDate + "T00:00:00").toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}
                    {" at "}
                    {booking.preferredTime && (() => {
                      const [h, m] = booking.preferredTime.split(":").map(Number);
                      const h12 = h % 12 || 12;
                      return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
                    })()}
                  </p>
                </div>
                <Button
                  onClick={resetBooking}
                  variant="outline"
                  className="mt-6 rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  Book Another
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-2xl border-pink-200/80 overflow-hidden shadow-xl shadow-pink-100/20">
              <div className="h-1.5 bg-gradient-to-r from-pink-400 via-rose-400 to-pink-400" />

              {/* Step indicators */}
              <div className="px-6 pt-5 pb-2">
                <div className="flex items-center justify-between max-w-xs mx-auto">
                  {[
                    { num: 1, label: "Service" },
                    { num: 2, label: "Date" },
                    { num: 3, label: "Time" },
                    { num: 4, label: "Details" },
                  ].map((step, i) => (
                    <div key={step.num} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                          bookingStep >= step.num
                            ? "bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-md shadow-pink-200/50"
                            : "bg-gray-100 text-gray-400"
                        }`}>
                          {bookingStep > step.num ? <CheckCircle2 className="h-4 w-4" /> : step.num}
                        </div>
                        <span className={`text-[10px] mt-1 font-medium ${bookingStep >= step.num ? "text-pink-600" : "text-gray-400"}`}>
                          {step.label}
                        </span>
                      </div>
                      {i < 3 && (
                        <div className={`w-8 sm:w-12 h-0.5 mx-1 mb-4 rounded-full ${bookingStep > step.num ? "bg-pink-400" : "bg-gray-200"}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <CardContent className="p-6 sm:p-8">
                {/* Step 1: Choose Service */}
                {bookingStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-900">Choose a Service</h3>
                    <div className="grid gap-2 max-h-80 overflow-y-auto pr-1">
                      {Object.entries(grouped).map(([category, items]) => (
                        <div key={category}>
                          <p className="text-[10px] font-bold text-pink-500 uppercase tracking-widest mb-1.5 mt-2">{category}</p>
                          {items.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => {
                                setBooking({ ...booking, serviceId: s.id, preferredTime: "" });
                                setSlotsData(null);
                                setBookingStep(2);
                              }}
                              className={`w-full text-left p-3 rounded-xl border transition-all mb-1.5 ${
                                booking.serviceId === s.id
                                  ? "border-pink-400 bg-pink-50 ring-2 ring-pink-200"
                                  : "border-gray-100 hover:border-pink-200 hover:bg-pink-50/30"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-pink-100 to-rose-100 text-pink-500">
                                  <Sparkles className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm text-gray-900">{s.name}</p>
                                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                    <Clock className="h-3 w-3" /> {s.durationMinutes} min
                                  </p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-gray-300" />
                              </div>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 2: Choose Date */}
                {bookingStep === 2 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setBookingStep(1)} className="p-1.5 rounded-lg hover:bg-pink-50 text-gray-400 hover:text-pink-600 transition-colors">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <h3 className="font-bold text-gray-900">Choose a Date</h3>
                    </div>
                    {selectedService && (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-pink-50/60 border border-pink-100">
                        <Sparkles className="h-4 w-4 text-pink-500" />
                        <span className="text-sm font-medium text-pink-700">{selectedService.name}</span>
                        <span className="text-xs text-pink-400">• {selectedService.durationMinutes} min</span>
                      </div>
                    )}

                    {/* Quick date picker - horizontal scroll of next 7 days */}
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {quickDates.map((d) => (
                        <button
                          key={d.date}
                          onClick={() => {
                            setBooking({ ...booking, preferredDate: d.date, preferredTime: "" });
                            fetchSlots(d.date, booking.serviceId);
                            setBookingStep(3);
                          }}
                          className={`flex-shrink-0 w-16 py-3 rounded-xl border text-center transition-all ${
                            booking.preferredDate === d.date
                              ? "border-pink-400 bg-pink-50 ring-2 ring-pink-200"
                              : "border-gray-100 hover:border-pink-200 hover:bg-pink-50/30"
                          }`}
                        >
                          <p className="text-[10px] font-bold text-gray-400 uppercase">{d.dayShort}</p>
                          <p className="text-lg font-black text-gray-900 leading-tight">{d.dayNum}</p>
                          <p className="text-[10px] text-gray-400">{d.monthShort}</p>
                          {d.isToday && <p className="text-[8px] font-bold text-pink-500 mt-0.5">TODAY</p>}
                        </button>
                      ))}
                    </div>

                    {/* Or pick a custom date */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Or choose another date</Label>
                      <Input
                        type="date"
                        value={booking.preferredDate}
                        onChange={(e) => {
                          setBooking({ ...booking, preferredDate: e.target.value, preferredTime: "" });
                          if (e.target.value) {
                            fetchSlots(e.target.value, booking.serviceId);
                            setBookingStep(3);
                          }
                        }}
                        min={minDate}
                        max={maxDate}
                        className="rounded-xl border-pink-100 focus-visible:ring-pink-300"
                      />
                    </div>
                  </div>
                )}

                {/* Step 3: Choose Time Slot */}
                {bookingStep === 3 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setBookingStep(2)} className="p-1.5 rounded-lg hover:bg-pink-50 text-gray-400 hover:text-pink-600 transition-colors">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <h3 className="font-bold text-gray-900">Pick a Time</h3>
                    </div>

                    {/* Summary bar */}
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-pink-50/60 border border-pink-100 text-sm">
                      <Sparkles className="h-4 w-4 text-pink-500 shrink-0" />
                      <span className="font-medium text-pink-700">{selectedService?.name}</span>
                      <span className="text-pink-300">•</span>
                      <Calendar className="h-3.5 w-3.5 text-pink-400" />
                      <span className="text-pink-600">
                        {booking.preferredDate && new Date(booking.preferredDate + "T00:00:00").toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 text-[10px] font-medium">
                      <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded bg-white border-2 border-pink-300" /> Available
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded bg-gradient-to-br from-pink-500 to-rose-500" /> Selected
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded bg-gray-100 border border-gray-200" /> Booked
                      </span>
                    </div>

                    {loadingSlots ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <div className="h-8 w-8 rounded-full border-3 border-pink-200 border-t-pink-500 animate-spin" />
                        <p className="text-xs text-gray-400">Loading available times...</p>
                      </div>
                    ) : slotsData?.closed ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                        <AlertCircle className="h-10 w-10 text-red-300" />
                        <p className="font-semibold text-red-600">Closed on {slotsData.dayName}</p>
                        <p className="text-xs text-gray-400">Please choose a different day.</p>
                        <Button onClick={() => setBookingStep(2)} variant="outline" size="sm" className="rounded-full border-pink-200 text-pink-600 mt-2">
                          <ChevronLeft className="h-3 w-3 mr-1" /> Pick Another Date
                        </Button>
                      </div>
                    ) : slotsData && slotsData.slots.length > 0 ? (
                      <>
                        {/* Morning slots */}
                        {slotsData.slots.some((s) => parseInt(s.time.split(":")[0]) < 12) && (
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Morning</p>
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                              {slotsData.slots
                                .filter((s) => parseInt(s.time.split(":")[0]) < 12)
                                .map((slot) => (
                                  <button
                                    key={slot.time}
                                    disabled={!slot.available}
                                    onClick={() => {
                                      setBooking({ ...booking, preferredTime: slot.time });
                                      setBookingStep(4);
                                    }}
                                    className={`py-2 px-1 rounded-lg text-xs font-semibold transition-all ${
                                      !slot.available
                                        ? "bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed line-through"
                                        : booking.preferredTime === slot.time
                                        ? "bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-md shadow-pink-200/50 scale-105"
                                        : "bg-white text-gray-700 border-2 border-pink-200 hover:border-pink-400 hover:bg-pink-50 cursor-pointer"
                                    }`}
                                  >
                                    {slot.label}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Afternoon slots */}
                        {slotsData.slots.some((s) => { const h = parseInt(s.time.split(":")[0]); return h >= 12 && h < 17; }) && (
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Afternoon</p>
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                              {slotsData.slots
                                .filter((s) => { const h = parseInt(s.time.split(":")[0]); return h >= 12 && h < 17; })
                                .map((slot) => (
                                  <button
                                    key={slot.time}
                                    disabled={!slot.available}
                                    onClick={() => {
                                      setBooking({ ...booking, preferredTime: slot.time });
                                      setBookingStep(4);
                                    }}
                                    className={`py-2 px-1 rounded-lg text-xs font-semibold transition-all ${
                                      !slot.available
                                        ? "bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed line-through"
                                        : booking.preferredTime === slot.time
                                        ? "bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-md shadow-pink-200/50 scale-105"
                                        : "bg-white text-gray-700 border-2 border-pink-200 hover:border-pink-400 hover:bg-pink-50 cursor-pointer"
                                    }`}
                                  >
                                    {slot.label}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Evening slots */}
                        {slotsData.slots.some((s) => parseInt(s.time.split(":")[0]) >= 17) && (
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Evening</p>
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                              {slotsData.slots
                                .filter((s) => parseInt(s.time.split(":")[0]) >= 17)
                                .map((slot) => (
                                  <button
                                    key={slot.time}
                                    disabled={!slot.available}
                                    onClick={() => {
                                      setBooking({ ...booking, preferredTime: slot.time });
                                      setBookingStep(4);
                                    }}
                                    className={`py-2 px-1 rounded-lg text-xs font-semibold transition-all ${
                                      !slot.available
                                        ? "bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed line-through"
                                        : booking.preferredTime === slot.time
                                        ? "bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-md shadow-pink-200/50 scale-105"
                                        : "bg-white text-gray-700 border-2 border-pink-200 hover:border-pink-400 hover:bg-pink-50 cursor-pointer"
                                    }`}
                                  >
                                    {slot.label}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* If all slots are booked */}
                        {slotsData.slots.every((s) => !s.available) && (
                          <div className="text-center py-6">
                            <AlertCircle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                            <p className="font-semibold text-amber-700 text-sm">Fully booked on this day</p>
                            <p className="text-xs text-gray-400 mt-1">Try a different date</p>
                            <Button onClick={() => setBookingStep(2)} variant="outline" size="sm" className="rounded-full border-pink-200 text-pink-600 mt-3">
                              <ChevronLeft className="h-3 w-3 mr-1" /> Pick Another Date
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-400 text-sm">
                        No time slots available. Please try another date.
                      </div>
                    )}
                  </div>
                )}

                {/* Step 4: Personal Details */}
                {bookingStep === 4 && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setBookingStep(3)} className="p-1.5 rounded-lg hover:bg-pink-50 text-gray-400 hover:text-pink-600 transition-colors">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <h3 className="font-bold text-gray-900">Your Details</h3>
                    </div>

                    {/* Summary */}
                    <div className="p-3 rounded-xl bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-100 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Sparkles className="h-4 w-4 text-pink-500" />
                        <span className="font-semibold text-pink-700">{selectedService?.name}</span>
                        <span className="text-pink-400">• {selectedService?.durationMinutes} min</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-pink-500" />
                        <span className="text-pink-700">
                          {booking.preferredDate && new Date(booking.preferredDate + "T00:00:00").toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-pink-500" />
                        <span className="text-pink-700 font-semibold">
                          {booking.preferredTime && (() => {
                            const [h, m] = booking.preferredTime.split(":").map(Number);
                            const h12 = h % 12 || 12;
                            return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
                          })()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">First Name *</Label>
                        <Input
                          value={booking.firstName}
                          onChange={(e) => setBooking({ ...booking, firstName: e.target.value })}
                          placeholder="Your first name"
                          className="rounded-xl border-pink-100 focus-visible:ring-pink-300"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Name *</Label>
                        <Input
                          value={booking.lastName}
                          onChange={(e) => setBooking({ ...booking, lastName: e.target.value })}
                          placeholder="Your last name"
                          className="rounded-xl border-pink-100 focus-visible:ring-pink-300"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone *</Label>
                        <Input
                          value={booking.phone}
                          onChange={(e) => setBooking({ ...booking, phone: e.target.value })}
                          placeholder="+251 9..."
                          className="rounded-xl border-pink-100 focus-visible:ring-pink-300"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</Label>
                        <Input
                          value={booking.email}
                          onChange={(e) => setBooking({ ...booking, email: e.target.value })}
                          placeholder="Optional"
                          className="rounded-xl border-pink-100 focus-visible:ring-pink-300"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</Label>
                      <Input
                        value={booking.notes}
                        onChange={(e) => setBooking({ ...booking, notes: e.target.value })}
                        placeholder="Any special requests or preferences..."
                        className="rounded-xl border-pink-100 focus-visible:ring-pink-300"
                      />
                    </div>
                    <Button
                      onClick={handleBook}
                      disabled={submitting}
                      className="w-full h-13 text-base font-semibold rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-lg shadow-pink-300/30"
                    >
                      {submitting ? "Booking..." : "Confirm Booking"}
                      <CheckCircle2 className="h-4 w-4 ml-2" />
                    </Button>
                    <p className="text-[10px] text-center text-gray-400">
                      Our team will confirm your appointment. We&apos;ll call if any changes are needed.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-12 sm:py-16 lg:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-100/60 border border-pink-200/50 text-xs font-semibold text-pink-600 uppercase tracking-widest mb-3 sm:mb-4">
                <Heart className="h-3 w-3" /> About Us
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">
                Your Beauty, Our Passion
              </h2>
              <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600 leading-relaxed">
                At Berchi Salon, we believe every person deserves to feel beautiful.
                Our team of skilled professionals brings years of experience and a deep passion
                for hair care and beauty treatments.
              </p>
              <p className="mt-2 sm:mt-3 text-sm sm:text-base text-gray-600 leading-relaxed">
                From trendy cuts to timeless styles, from luxurious treatments to quick touch-ups —
                we provide personalized service in a warm, friendly environment that feels like home.
              </p>
              <div className="mt-6 sm:mt-8 grid grid-cols-3 gap-4 sm:gap-6">
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-black text-pink-600">5+</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Years Experience</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-black text-pink-600">1000+</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Happy Clients</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-black text-pink-600">10+</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Expert Stylists</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-pink-200/30">
                <Image src="https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=600&q=80" alt="Berchi Salon interior" width={600} height={600} className="w-full h-full object-cover" unoptimized />
              </div>
              <div className="absolute -bottom-3 -right-3 sm:-bottom-4 sm:-right-4 w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-rose-200/60 to-pink-200/40 rounded-2xl -z-10" />
              <div className="absolute -top-3 -left-3 sm:-top-4 sm:-left-4 w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-pink-200/40 to-rose-200/30 rounded-2xl -z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-12 sm:py-16 lg:py-20 bg-gradient-to-b from-white to-pink-50/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">Get in Touch</h2>
            <p className="mt-2 sm:mt-3 text-sm sm:text-base text-gray-500">We&apos;d love to hear from you</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            <Card className="rounded-xl sm:rounded-2xl border-pink-100 hover:border-pink-200 hover:shadow-lg transition-all text-center group">
              <CardContent className="py-5 sm:py-8 px-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-pink-100 text-pink-600 mx-auto mb-3 sm:mb-4 group-hover:bg-pink-200 transition-colors">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <h3 className="font-semibold text-xs sm:text-sm">Location</h3>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Addis Ababa, Ethiopia</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl sm:rounded-2xl border-pink-100 hover:border-pink-200 hover:shadow-lg transition-all text-center group">
              <CardContent className="py-5 sm:py-8 px-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-pink-100 text-pink-600 mx-auto mb-3 sm:mb-4 group-hover:bg-pink-200 transition-colors">
                  <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <h3 className="font-semibold text-xs sm:text-sm">Phone</h3>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">+251 91 234 5678</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl sm:rounded-2xl border-pink-100 hover:border-pink-200 hover:shadow-lg transition-all text-center group">
              <CardContent className="py-5 sm:py-8 px-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-pink-100 text-pink-600 mx-auto mb-3 sm:mb-4 group-hover:bg-pink-200 transition-colors">
                  <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <h3 className="font-semibold text-xs sm:text-sm">Email</h3>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">info@berchi.com</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl sm:rounded-2xl border-pink-100 hover:border-pink-200 hover:shadow-lg transition-all text-center group">
              <CardContent className="py-5 sm:py-8 px-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-pink-100 text-pink-600 mx-auto mb-3 sm:mb-4 group-hover:bg-pink-200 transition-colors">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <h3 className="font-semibold text-xs sm:text-sm">Hours</h3>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Mon–Sat: 9AM–8PM</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-white py-8 sm:py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-500">
                <Scissors className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-black text-base sm:text-lg tracking-tight">BERCHI SALON</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Beauty & Wellness</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 text-xs sm:text-sm text-gray-400">
              <a href="#services" className="hover:text-pink-400 transition-colors">Services</a>
              <a href="#booking" className="hover:text-pink-400 transition-colors">Book</a>
              <a href="#about" className="hover:text-pink-400 transition-colors">About</a>
              <a href="#contact" className="hover:text-pink-400 transition-colors">Contact</a>
            </div>
            <div className="flex items-center gap-3">
              <a href="#" className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-gray-800 hover:bg-pink-600 transition-colors">
                <Globe className="h-4 w-4" />
              </a>
              <a href="tel:+251912345678" className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-gray-800 hover:bg-pink-600 transition-colors">
                <Phone className="h-4 w-4" />
              </a>
            </div>
          </div>
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-800 text-center text-[10px] sm:text-xs text-gray-600 space-y-1.5">
            <p>© {new Date().getFullYear()} Berchi Salon. All rights reserved.</p>
            <p>
              Developed by{" "}
              <a
                href="https://syntaxsoftwaresolution.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-pink-400/80 hover:text-pink-300 transition-colors font-medium"
              >
                Syntax Software Solution
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
