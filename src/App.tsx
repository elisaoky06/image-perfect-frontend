import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import BookAppointment from "./pages/BookAppointment.tsx";
import DoctorDashboard from "./pages/DoctorDashboard.tsx";
<<<<<<< HEAD
import VerifyPayment from "./pages/VerifyPayment.tsx";
=======
import ServiceDetail from "./pages/ServiceDetail.tsx";
>>>>>>> 603410446f9f270a2783c7c9d0c0e7f1854ef592

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/appointments" element={<BookAppointment />} />
            <Route path="/doctor" element={<DoctorDashboard />} />
<<<<<<< HEAD
            <Route path="/payment/verify" element={<VerifyPayment />} />
=======
            <Route path="/services/:slug" element={<ServiceDetail />} />
>>>>>>> 603410446f9f270a2783c7c9d0c0e7f1854ef592
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
