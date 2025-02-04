import { BillingSettings } from './Setting';
import { TableData } from './Table';

export enum BillingInvoiceStatus {
  PAID = 'paid',
  OPEN = 'open',
  DRAFT = 'draft',
}

export interface BillingTax extends TableData {
  description: string;
  displayName: string;
  percentage: number;
}

export interface BillingUserData extends TableData {
  hasSynchroError: boolean;
}

export interface BillingInvoice extends TableData {
  id: string;
  createdOn?: Date;
  invoiceID: string;
  userID?: string;
  number: string;
  status: BillingInvoiceStatus;
  amount?: number;
  currency: string;
  downloadable: boolean;
  sessions: BillingSessionData[];
}

export interface BillingSessionData {
  transactionID: number;
  description: string;
  pricingData: any;
}

export enum BillingButtonAction {
  PAY_INVOICE = 'pay_invoice',
  SYNCHRONIZE_BILLING_USERS = 'synchronize_billing_users',
  SYNCHRONIZE_INVOICES = 'synchronize_invoices',
  DOWNLOAD_INVOICE = 'download_invoice',
  CREATE_PAYMENT_METHOD = 'create_payment_method',
  DELETE_PAYMENT_METHOD = 'delete_payment_method',
}

export interface BillingTransactionData {
  status?: string;
  invoiceID?: string;
  invoiceStatus?: BillingInvoiceStatus;
  invoiceItem?: BillingInvoiceItem;
  lastUpdate?: Date;
}

export interface BillingInvoiceItem {
  description: string;
  amount: number;
  taxes?: string[];
}

export interface BillingPaymentMethod {
  id: string;
  brand: string;
  expiringOn: string;
  last4: number;
  type: string;
  createdOn: Date;
  isDefault: boolean;
}

export interface PaymentDialogData extends TableData {
  userId: string;
  setting: BillingSettings;
}
