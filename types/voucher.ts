export type VoucherType = "vipFriday" | "vipSaturday" | "vipGuests" | "drink" | "food";
export type VoucherStatus = "pending" | "created" | "sent" | "cancelled" | "error";

export interface Voucher {
  id: string;
  sponsorId: string;
  editionId: string;
  dealId: string;
  type: VoucherType;
  value: number;
  status: VoucherStatus;
  code: string;
  url: string;
  recipientName: string;
  recipientEmail: string;
  createdAt: string | null;
  sentAt: string | null;
  cancelledAt: string | null;
  error: string | null;
}

/* Older saved data used the type "extra" for what is now "food". */
export type StoredVoucher = Omit<Voucher, "type"> & { type: VoucherType | "extra" };
