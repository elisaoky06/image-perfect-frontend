import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function VerifyPayment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const reference = searchParams.get("reference");

  useEffect(() => {
    if (!reference) {
      setStatus("error");
      toast.error("No payment reference found.");
      return;
    }

    const verify = async () => {
      try {
        const res = await api<{ success: boolean; message?: string }>(`/api/payments/verify/${reference}`);
        if (res.success) {
          setStatus("success");
          toast.success("Payment verified successfully. Your appointment is confirmed!");
          setTimeout(() => navigate("/appointments"), 3000);
        } else {
          setStatus("error");
          toast.error("Payment verification failed. Please contact support.");
        }
      } catch (error) {
        setStatus("error");
        toast.error(error instanceof Error ? error.message : "Failed to verify payment");
      }
    };

    verify();
  }, [reference, navigate]);

  return (
    <SiteLayout>
      <div className="section-padding flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-md mx-auto p-6 bg-card rounded-xl border shadow-sm">
          {status === "verifying" && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
              <h2 className="text-xl font-semibold text-foreground">Verifying Payment...</h2>
              <p className="text-muted-foreground">Please wait while we confirm your payment with Paystack.</p>
            </>
          )}
          {status === "success" && (
            <>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto text-green-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground">Payment Successful!</h2>
              <p className="text-muted-foreground">Redirecting you back to your appointments...</p>
            </>
          )}
          {status === "error" && (
            <>
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto text-red-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground">Verification Failed</h2>
              <p className="text-muted-foreground">We could not verify your payment. Please try again or contact support.</p>
              <button
                onClick={() => navigate("/appointments")}
                className="mt-4 px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90 transition"
              >
                Return to Appointments
              </button>
            </>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}
