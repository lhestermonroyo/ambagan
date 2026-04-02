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

  const expenseId = uuid();
  let receiptUrl: string | null = null;

  const { amount, description, receipt, groupId, payerId } = expensePayload;

  if (receipt) {
    const uploadResponse = await uploadFile(receipt.assets[0], "receipts");

    if (uploadResponse.error) throw uploadResponse.error;

    receiptUrl = uploadResponse.data?.publicUrl || null;
  }

  const expenseResponse = await supabase.from(tables.EXPENSES_TBL).insert([
    {
      id: expenseId,
      group_id: groupId,
      created_by: user.data.user.id,
      paid_by: payerId,
      amount,
      description,
      receipt: receiptUrl
    }
  ]);

  if (expenseResponse.error) {
    throw expenseResponse.error;
  }

  const splitResponses = await supabase.from(tables.EXPENSE_SPLITS_TBL).insert(
    splits.map((split) => ({
      expense_id: expenseId,
      paid_by: payerId,
      user_id: split.userId,
      amount: split.amount,
      percentage: split.percentage,
      status: payerId === split.userId ? "paid" : "pending"
    }))
  );

  if (splitResponses.error) {
    throw splitResponses.error;
  }

  return { success: true, message: "Expense created successfully" };
};

export const deleteExpense = async (expenseId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const expenseResponse = await supabase
    .from(tables.EXPENSES_TBL)
    .select("paid_by")
    .eq("id", expenseId)
    .single();

  if (expenseResponse.error) {
    throw expenseResponse.error;
  }

  if (expenseResponse.data?.paid_by !== user.data.user.id) {
    throw new Error("User not authorized to delete this expense");
  }

  const splitDeleteResponse = await supabase
    .from(tables.EXPENSE_SPLITS_TBL)
    .delete()
    .eq("expense_id", expenseId);

  if (splitDeleteResponse.error) {
    throw splitDeleteResponse.error;
  }

  const expenseDeleteResponse = await supabase
    .from(tables.EXPENSES_TBL)
    .delete()
    .eq("id", expenseId);

  if (expenseDeleteResponse.error) {
    throw expenseDeleteResponse.error;
  }

  return { success: true, message: "Expense deleted successfully" };
};

export const getExpensesByGroup = async (groupId: string) => {
  const { data, error } = await supabase
    .from(tables.EXPENSES_TBL)
    .select(
      `*, created_by:created_by!inner(id, email, first_name, last_name, avatar), paid_by:paid_by!inner(id, email, first_name, last_name, avatar)`
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
};

export const getExpenseById = async (id: string) => {
  const { data, error } = await supabase
    .from(tables.EXPENSES_TBL)
    .select(
      `*, created_by:created_by!inner(id, email, first_name, last_name, avatar), paid_by:paid_by!inner(id, email, first_name, last_name, avatar)`
    )
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const getSplitsByExpense = async (expenseId: string) => {
  const { data, error } = await supabase
    .from(tables.EXPENSE_SPLITS_TBL)
    .select(`*, member:user_id!inner(id, email, first_name, last_name, avatar)`)
    .eq("expense_id", expenseId);

  if (error) {
    throw error;
  }

  return data;
};

export const createPaidRequest = async (expensePayload: {
  note: string;
  receipt: ImagePickerSuccessResult | null;
  expenseSplitId: string;
}) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }
  const { note, receipt, expenseSplitId } = expensePayload;
  let receiptUrl: string | null = null;

  if (receipt) {
    const uploadResponse = await uploadFile(receipt.assets[0], "receipts");

    if (uploadResponse.error) throw uploadResponse.error;

    receiptUrl = uploadResponse.data?.publicUrl || null;
  }

  const splitResponse = await supabase
    .from(tables.EXPENSE_SPLITS_TBL)
    .update({
      status: "requested",
      note,
      receipt: receiptUrl
    })
    .eq("id", expenseSplitId);

  if (splitResponse.error) {
    throw splitResponse.error;
  }

  return { success: true, message: "Request created successfully" };
};

export const undoPaidRequest = async (expenseSplitId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const splitResponse = await supabase
    .from(tables.EXPENSE_SPLITS_TBL)
    .update({
      status: "pending",
      note: null,
      receipt: null
    })
    .eq("id", expenseSplitId);

  if (splitResponse.error) {
    throw splitResponse.error;
  }

  return { success: true, message: "Paid request undone successfully" };
};

export const markAsPaid = async (expensePayload: {
  note: string;
  receipt: ImagePickerSuccessResult | null;
  expenseSplitId: string;
}) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }
  const { note, receipt, expenseSplitId } = expensePayload;
  let receiptUrl: string | null = null;

  if (receipt) {
    const uploadResponse = await uploadFile(receipt.assets[0], "receipts");

    if (uploadResponse.error) throw uploadResponse.error;

    receiptUrl = uploadResponse.data?.publicUrl || null;
  }

  const splitResponse = await supabase
    .from(tables.EXPENSE_SPLITS_TBL)
    .update({
      status: "paid",
      payer_note: note,
      receipt: receiptUrl
    })
    .eq("id", expenseSplitId);

  if (splitResponse.error) {
    throw splitResponse.error;
  }

  return { success: true, message: "Marked as paid successfully" };
};

export const getActivitiesByUserId = async (
  userId: string,
  page: number = 0,
  limit: number = 10,
  withMetadata: boolean = false
) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const from = page * limit;
  const to = from + limit - 1;

  const expenseSplitResponse = await supabase
    .from(tables.EXPENSE_SPLITS_TBL)
    .select(
      `id, expense_id, created_at, paid_by, amount, status, member:user_id!inner(id, email, first_name, last_name, avatar), expense:expense_id(group_id, description, amount, paid_by:paid_by!inner(id, email, first_name, last_name, avatar))`,
      { count: withMetadata ? "exact" : undefined }
    )
    .or(`user_id.eq.${userId},paid_by.eq.${userId}`)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (expenseSplitResponse.error) {
    throw expenseSplitResponse.error;
  }

  if (withMetadata) {
    const totalCount = expenseSplitResponse.count || 0;
    const totalPages = Math.ceil(totalCount / limit);
    const hasNext = page < totalPages - 1;
    const hasPrevious = page > 0;

    return {
      data: expenseSplitResponse.data as any,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext,
        hasPrevious
      }
    };
  }

  return expenseSplitResponse.data as any;
};

export const getExpenseStatsByUserId = async (userId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const payResponse = await supabase
    .from(tables.EXPENSE_SPLITS_TBL)
    .select("amount")
    .eq("user_id", userId)
    .or(`status.eq.pending,status.eq.requested`);

  if (payResponse.error) {
    throw payResponse.error;
  }

  const receiveResponse = await supabase
    .from(tables.EXPENSE_SPLITS_TBL)
    .select("amount")
    .eq("paid_by", userId)
    .or(`status.eq.pending,status.eq.requested`);

  if (receiveResponse.error) {
    throw receiveResponse.error;
  }

  const totalPay =
    payResponse.data?.reduce((sum, split) => sum + split.amount, 0) || 0;
  const totalReceive =
    receiveResponse.data?.reduce((sum, split) => sum + split.amount, 0) || 0;

  return { totalPay, totalReceive };
};

export const getUnpaidExpenses = async (groupId: string, userId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  // add or condition to check if user has paid_by in the expenses splits table and the status is pending or requested
  const response = await supabase
    .from(tables.EXPENSE_SPLITS_TBL)
    .select(`id, ${tables.EXPENSES_TBL} (group_id)`)
    .eq("user_id", userId)
    .eq(`${tables.EXPENSES_TBL}.group_id`, groupId)
    .or(`paid_by.eq.${userId},status.eq.pending,status.eq.requested`);

  if (response.error) {
    throw response.error;
  }

  return (response.data?.length || 0) > 0;
};
