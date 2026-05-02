import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle } from "lucide-react";
import { api } from "@/lib/api";

type ReceiptProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
};

type ReceiptData = {
  appointmentId: string;
  patient: { firstName: string; lastName: string; email: string };
  doctor: { firstName: string; lastName: string; email: string };
  amount: number;
  currency: string;
  method: string;
  transactionId: string;
  status: string;
  createdAt: string;
  adminAccount?: any;
  appointmentDate: string;
  consultationType: string;
};

export function ReceiptDialog({ open, onOpenChange, appointmentId }: ReceiptProps) {
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && appointmentId) {
      setLoading(true);
      api<{ receipt: ReceiptData }>(`/api/payments/receipt/${appointmentId}`)
        .then((res) => setReceipt(res.receipt))
        .catch(() => setReceipt(null))
        .finally(() => setLoading(false));
    } else {
      setReceipt(null);
    }
  }, [open, appointmentId]);

  if (!receipt && !loading) return null;

  const receiptNo = `RCP-${appointmentId.slice(-8).toUpperCase()}`;
  const transactionId = receipt?.transactionId || `TXN-${appointmentId}`;
  const amount = Number(receipt?.amount || 0).toFixed(2);
  const method = receipt?.method || "Mobile Money";

  const apptDate = receipt?.appointmentDate ? new Date(receipt.appointmentDate).toLocaleString("en-GH", {
    weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit",
  }) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-700">
            <CheckCircle className="w-5 h-5" /> Payment Receipt
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-center text-muted-foreground">Loading receipt...</p>
        ) : receipt ? (
          <>
            <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl mb-2 border border-emerald-100 text-center">
              <p className="text-sm font-semibold uppercase tracking-wider mb-1">Total Paid</p>
              <p className="text-3xl font-black">GHS {amount}</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Receipt No.</span>
                <span className="font-medium">{receiptNo}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Transaction ID</span>
                <span className="font-mono text-xs">{transactionId}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Method</span>
                <span className="font-medium">{method}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Appointment Time</span>
                <span className="font-medium text-right">{apptDate}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Consultation Type</span>
                <span className="font-medium">{receipt.consultationType || "In-Person"}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Doctor</span>
                <span className="font-medium">Dr. {receipt.doctor.firstName} {receipt.doctor.lastName}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Patient</span>
                <span className="font-medium">{receipt.patient.firstName} {receipt.patient.lastName}</span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-center text-muted-foreground">Receipt not found</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
