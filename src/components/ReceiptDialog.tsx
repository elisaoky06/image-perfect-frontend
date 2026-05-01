import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle } from "lucide-react";

type ReceiptProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any; // Type generic enough for both BookAppointment & DoctorDashboard
};

export function ReceiptDialog({ open, onOpenChange, appointment }: ReceiptProps) {
  if (!appointment) return null;

  const receiptNo = `RCP-${appointment._id?.slice(-8).toUpperCase()}`;
  const transactionId = appointment.paymentDetails?.transactionId || `TXN-${appointment._id}`;
  const amount = Number(appointment.amount || 0).toFixed(2);
  const method = appointment.paymentDetails?.method || "Mobile Money";

  const isApproved = appointment.status === "scheduled" || appointment.status === "completed";

  const apptDate = new Date(appointment.startAt).toLocaleString("en-GH", {
    weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-700">
            <CheckCircle className="w-5 h-5" /> Payment Receipt
          </DialogTitle>
        </DialogHeader>

        <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl mb-2 border border-emerald-100 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider mb-1">Total Paid</p>
          <p className="text-3xl font-black">GHS {amount}</p>
          {!isApproved && (
            <p className="text-xs mt-2 bg-yellow-100 text-yellow-800 inline-block px-2 py-0.5 rounded-full border border-yellow-200">
              Pending Admin Approval
            </p>
          )}
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
            <span className="font-medium">{appointment.consultationType || "In-Person"}</span>
          </div>
          {appointment.doctor?.firstName && (
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Doctor</span>
              <span className="font-medium">Dr. {appointment.doctor.firstName} {appointment.doctor.lastName}</span>
            </div>
          )}
          {appointment.patient?.firstName && (
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Patient</span>
              <span className="font-medium">{appointment.patient.firstName} {appointment.patient.lastName}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
