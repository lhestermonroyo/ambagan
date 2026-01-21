import { TransactionState } from '@/types/transactions';
import { mockTransactionPreviews } from '@/utils/data';
import { create } from 'zustand';

const initialState: TransactionState = {
  preview: [...mockTransactionPreviews],
  details: null
};

const TRANSACTION_STATE = create<
  TransactionState & {
    reset: () => void;
  }
>((set) => ({
  ...initialState,
  reset: () => set(initialState)
}));

export default TRANSACTION_STATE;
