import {
  Expense,
  ExpensePayer,
  ExpensePreview,
  MemberSplit,
  Payment,
  PaymentPreview
} from "@/types/expenses";
import { splitTypes, tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";
import { uploadFile } from "@/utils/upload";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { v4 as uuid } from "uuid";

export const saveExpense = async (
  expensePayload: {
    amount: number;
    description: string;
    proof_of_payment: ImagePickerSuccessResult | null;
    group_id: string;
    split_type: (typeof splitTypes)[number]["value"];
  },
  payers: { userId: string; amount: number }[],
  memberSplits: { userId: string; amount: number; percentage: number }[],
  paymentSplits: { memberSplitId: string; payerId: string; amount: number }[]
) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const expenseId = uuid();
  let proofUrl: string | null = null;

  const { amount, description, proof_of_payment, group_id, split_type } =
    expensePayload;

  if (proof_of_payment) {
    const uploadResponse = await uploadFile(
      proof_of_payment.assets[0],
      "receipts"
    );

    if (uploadResponse.error) throw uploadResponse.error;

    proofUrl = uploadResponse.data?.publicUrl || null;
  }

  const expenseResponse = await supabase.from(tables.EXPENSES_TBL).insert([
    {
      id: expenseId,
      group_id: group_id,
      creator_id: user.data.user.id,
      amount,
      description,
      proof_of_payment: proofUrl,
      split_type
    }
  ]);

  if (expenseResponse.error) {
    throw expenseResponse.error;
  }

  const [payersResponse, splitsResponse, paymentsResponse] = await Promise.all([
    supabase.from(tables.EXPENSE_PAYERS_TBL).insert(
      payers.map((payer) => ({
        expense_id: expenseId,
        payer_id: payer.userId,
        amount: payer.amount
      }))
    ),
    supabase.from(tables.MEMBER_SPLITS_TBL).insert(
      memberSplits.map((split) => ({
        expense_id: expenseId,
        member_id: split.userId,
        amount: split.amount,
        percentage: split.percentage
      }))
    ),
    supabase.from(tables.PAYMENT_SPLITS_TBL).insert(
      paymentSplits.map((split) => ({
        group_id: group_id,
        expense_id: expenseId,
        member_id: split.memberSplitId,
        payer_id: split.payerId,
        amount: split.amount,
        status: "pending"
      }))
    )
  ]);

  if (payersResponse.error) {
    throw payersResponse.error;
  }

  if (splitsResponse.error) {
    throw splitsResponse.error;
  }

  if (paymentsResponse.error) {
    throw paymentsResponse.error;
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
    .select("creator_id")
    .eq("id", expenseId)
    .single();

  if (expenseResponse.error) {
    throw expenseResponse.error;
  }

  if (expenseResponse.data?.creator_id !== user.data.user.id) {
    throw new Error("User not authorized to delete this expense");
  }

  const responses = await Promise.all([
    supabase
      .from(tables.EXPENSE_PAYERS_TBL)
      .delete()
      .eq("expense_id", expenseId),
    supabase
      .from(tables.MEMBER_SPLITS_TBL)
      .delete()
      .eq("expense_id", expenseId),
    supabase
      .from(tables.PAYMENT_SPLITS_TBL)
      .delete()
      .eq("expense_id", expenseId)
  ]);

  for (const response of responses) {
    if (response.error) {
      throw response.error;
    }
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

export const getPaymentsByUserId = async (
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
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(
      `id, created_at, group_id, expense_id, member:member_id!inner(id, email, phone, first_name, last_name, avatar), payer:payer_id!inner(id, email, phone, first_name, last_name, avatar), amount, status`,
      { count: withMetadata ? "exact" : undefined }
    )
    .or(`member_id.eq.${userId},payer_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (expenseSplitResponse.error) {
    throw expenseSplitResponse.error;
  }

  const normalize = (data: any[]) =>
    data.map((item) => ({
      ...item,
      member: Array.isArray(item.member) ? item.member[0] : item.member,
      payer: Array.isArray(item.payer) ? item.payer[0] : item.payer
    }));

  if (withMetadata) {
    const totalCount = expenseSplitResponse.count || 0;
    const totalPages = Math.ceil(totalCount / limit);
    const hasNext = page < totalPages - 1;
    const hasPrevious = page > 0;

    return {
      data: normalize(expenseSplitResponse.data) as PaymentPreview[],
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

  return {
    data: normalize(expenseSplitResponse.data) as PaymentPreview[]
  };
};

export const getPaymentsByExpenseId = async (expenseId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const paymentListResponse = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(
      `*, member:member_id!inner(id, email, phone, first_name, last_name, avatar), payer:payer_id!inner(id, email, phone, first_name, last_name, avatar)`
    )
    .eq("expense_id", expenseId)
    .order("created_at", { ascending: false });

  if (paymentListResponse.error) {
    throw paymentListResponse.error;
  }

  return paymentListResponse.data.map((item) => ({
    ...item,
    member: Array.isArray(item.member) ? item.member[0] : item.member,
    payer: Array.isArray(item.payer) ? item.payer[0] : item.payer
  })) as Payment[];
};

export const getStatsByUserId = async (userId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const toPayResponse = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select("amount")
    .eq("member_id", userId)
    .or(`status.eq.pending,status.eq.requested`);

  if (toPayResponse.error) {
    throw toPayResponse.error;
  }

  const toReceiveResponse = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select("amount")
    .eq("payer_id", userId)
    .or(`status.eq.pending,status.eq.requested`);

  if (toReceiveResponse.error) {
    throw toReceiveResponse.error;
  }

  const totalPay =
    toPayResponse.data?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
  const totalReceive =
    toReceiveResponse.data?.reduce((sum, payment) => sum + payment.amount, 0) ||
    0;

  return { totalPay, totalReceive };
};

export const getExpensesByGroupId = async (groupId: string) => {
  const { data, error } = await supabase
    .from(tables.EXPENSES_TBL)
    .select(
      `id, created_at, group_id, amount, description,  creator:creator_id!inner(id, email, phone, first_name, last_name, avatar)`
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const expenseList = await Promise.all(
    data.map(async (item) => {
      try {
        const payerData = await getPayersByExpenseId(item.id);

        return {
          ...item,
          creator: Array.isArray(item.creator) ? item.creator[0] : item.creator,
          payer_list: payerData
        };
      } catch (error) {
        return {
          ...item,
          creator: Array.isArray(item.creator) ? item.creator[0] : item.creator,
          payer_list: []
        };
      }
    })
  );

  return expenseList as ExpensePreview[];
};

export const getExpenseById = async (id: string) => {
  const { data, error } = await supabase
    .from(tables.EXPENSES_TBL)
    .select(
      `*, creator:creator_id!inner(id, email, phone, first_name, last_name, avatar)`
    )
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data as Expense;
};

export const getPayersByExpenseId = async (expenseId: string) => {
  const { data, error } = await supabase
    .from(tables.EXPENSE_PAYERS_TBL)
    .select(
      "*, payer:payer_id!inner(id, email, phone, first_name, last_name, avatar)"
    )
    .eq("expense_id", expenseId);

  if (error) {
    throw error;
  }

  return data as ExpensePayer[];
};

export const getMemberSplitsByExpenseId = async (expenseId: string) => {
  const { data, error } = await supabase
    .from(tables.MEMBER_SPLITS_TBL)
    .select(
      `*, member:member_id!inner(id, email, phone, first_name, last_name, avatar)`
    )
    .eq("expense_id", expenseId);

  if (error) {
    throw error;
  }

  return data.map((item) => ({
    ...item,
    member: Array.isArray(item.member) ? item.member[0] : item.member
  })) as MemberSplit[];
};

export const getSplitsByExpense = async (expenseId: string) => {
  const { data, error } = await supabase
    .from(tables.MEMBER_SPLITS_TBL)
    .select(`*, member:user_id!inner(id, email, first_name, last_name, avatar)`)
    .eq("expense_id", expenseId);

  if (error) {
    throw error;
  }

  return data;
};

export const createSettledRequest = async (expensePayload: {
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
    .from(tables.PAYMENT_SPLITS_TBL)
    .update({
      status: "requested",
      member_note: note,
      proof_of_payment: receiptUrl
    })
    .eq("id", expenseSplitId);

  if (splitResponse.error) {
    throw splitResponse.error;
  }

  return { success: true, message: "Request created successfully" };
};

export const undoSettledRequest = async (expenseSplitId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const splitResponse = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .update({
      status: "pending",
      member_note: null,
      proof_of_payment: null
    })
    .eq("id", expenseSplitId);

  if (splitResponse.error) {
    throw splitResponse.error;
  }

  return { success: true, message: "Settled request undone successfully" };
};

export const markAsSettled = async (expensePayload: {
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
    .from(tables.PAYMENT_SPLITS_TBL)
    .update({
      status: "settled",
      payer_note: note,
      proof_of_payment: receiptUrl,
      status_updated_at: new Date().toISOString()
    })
    .eq("id", expenseSplitId);

  if (splitResponse.error) {
    throw splitResponse.error;
  }

  return { success: true, message: "Marked as settled successfully" };
};

export const getUnreadActivitiesByUserId = async (userId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }
  const [userReadResponse, payerReadResponse] = await Promise.all([
    supabase
      .from(tables.MEMBER_SPLITS_TBL)
      .select(
        "id, expense_id, created_at, paid_by, amount, status, member:user_id!inner(id, email, first_name, last_name, avatar), expense:expense_id(group_id, description, amount, paid_by:paid_by!inner(id, email, first_name, last_name, avatar))"
      )
      .or(`user_id.eq.${userId}`)
      .eq("user_read", false),
    supabase
      .from(tables.MEMBER_SPLITS_TBL)
      .select("id, expense_id, status")
      .or(`user_id.eq.${userId}`)
      .eq("payer_read", false)
  ]);

  if (userReadResponse.error && payerReadResponse.error) {
    throw new Error("Failed to fetch unread activities");
  }

  const payableCount =
    userReadResponse.data?.filter(
      (item) => item.status === "pending" || item.status === "requested"
    ).length || 0;

  const requestCount =
    payerReadResponse.data?.filter((item) => item.status === "requested")
      .length || 0;
  const pendingCount =
    payerReadResponse.data?.filter((item) => item.status === "pending")
      .length || 0;
  const receivableCount = requestCount + pendingCount || 0;

  return {
    requestCount,
    pendingCount,
    payableCount,
    receivableCount
  };
};

export const getPaymentsByGroupAndUserId = async (
  groupId: string,
  userId: string
) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(
      `*, member:member_id!inner(id, email, phone, first_name, last_name, avatar), payer:payer_id!inner(id, email, phone, first_name, last_name, avatar)`
    )
    .eq("group_id", groupId)
    .or(`member_id.eq.${userId},payer_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map((item) => ({
    ...item,
    member: Array.isArray(item.member) ? item.member[0] : item.member,
    payer: Array.isArray(item.payer) ? item.payer[0] : item.payer
  })) as Payment[];
};

export const getUnpaidPayments = async (groupId: string, userId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const response = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(`id`)
    .eq("group_id", groupId)
    .or(`member_id.eq.${userId},payer_id.eq.${userId}`)
    .or(`status.eq.pending,status.eq.requested`);

  if (response.error) {
    throw response.error;
  }

  return (response.data?.length || 0) > 0;
};
