import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";
import { uploadFile } from "@/utils/upload";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { v4 as uuid } from "uuid";

export const createExpense = async (
  expensePayload: {
    amount: number;
    description: string;
    receipt: ImagePickerSuccessResult | null;
    groupId: string;
    payerId: string;
  },
  splits: {
    userId: string;
    amount: number;
    percentage: number;
  }[]
) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const transactionId = uuid();
  let receiptUrl: string | null = null;

  const { amount, description, receipt, groupId, payerId } = expensePayload;

  if (receipt) {
    const uploadResponse = await uploadFile(receipt.assets[0], "receipts");

    if (uploadResponse.error) throw uploadResponse.error;

    receiptUrl = uploadResponse.data?.publicUrl || null;
  }

  const transactionResponse = await supabase
    .from(tables.TRANSACTIONS_TBL)
    .insert([
      {
        id: transactionId,
        group_id: groupId,
        created_by: user.data.user.id,
        paid_by: payerId,
        type: "expense",
        amount,
        description,
        receipt: receiptUrl
      }
    ]);

  if (transactionResponse.error) {
    throw transactionResponse.error;
  }

  const splitResponses = await supabase
    .from(tables.TRANSACTION_SPLITS_TBL)
    .insert(
      splits.map((split) => ({
        transaction_id: transactionId,
        user_id: split.userId,
        amount: split.amount,
        percentage: split.percentage,
        status: "pending"
      }))
    );

  if (splitResponses.error) {
    throw splitResponses.error;
  }

  return { success: true, message: "Expense created successfully" };
};

export const getTransactionsByGroup = async (
  groupId: string,
  type = "expense"
) => {
  const { data, error } = await supabase
    .from(tables.TRANSACTIONS_TBL)
    .select(
      `*, created_by:created_by!inner(id, email, first_name, last_name, avatar), paid_by:paid_by!inner(id, email, first_name, last_name, avatar)`
    )
    .eq("group_id", groupId)
    .eq("type", type)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
};

export const getSplitsByTransaction = async (transactionId: string) => {
  const { data, error } = await supabase
    .from(tables.TRANSACTION_SPLITS_TBL)
    .select(`*, member:user_id!inner(id, email, first_name, last_name, avatar)`)
    .eq("transaction_id", transactionId);

  if (error) {
    throw error;
  }

  return data;
};
