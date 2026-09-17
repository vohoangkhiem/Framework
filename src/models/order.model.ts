/** Raw values typed into the "Place order" form; every field is optional to allow validation tests. */
export interface OrderFormData {
  name?: string;
  country?: string;
  city?: string;
  creditCard?: string;
  month?: string;
  year?: string;
}

/** Order data guaranteed to satisfy the form's mandatory fields (name and credit card). */
export type ConfirmedOrderData = Required<Pick<OrderFormData, 'name' | 'creditCard'>> &
  Omit<OrderFormData, 'name' | 'creditCard'>;

/** Structured content of the purchase confirmation dialog. */
export interface OrderConfirmation {
  id: number;
  amount: number;
  cardNumber: string;
  name: string;
  /** Raw date text exactly as rendered by the application (d/m/yyyy with a zero-based month). */
  date: string;
}
