import { createNotification } from "@/features/notifications/services/notification.service";
import {
  Expense,
  ExpensePayer,
  ExpensePreview,
  MemberSplit,
  Payment,
  PaymentPreview
} from "@/types/expenses";
import { NotificationType } from "@/types/notifications";
import { splitTypes, tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";
import { uploadFile } from "@/utils/upload";
import { sendPushNotification } from "@/utils/sendPushNotifications";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { v4 as uuid } from "uuid";

export const saveExpense = async (
  expensePayload: {
    amount: number;
    description: string;
    proof_of_payment: ImagePickerSuccessResult | null;
    group_id: string;
    split_type: (typeof splitTypes)[number]["value"];
    currency: string;
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

  const {
    amount,
    description,
    proof_of_payment,
    group_id,
    split_type,
    currency
  } = expensePayload;

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
      split_type,
      currency: currency || "PHP"
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

  const membersToNotify = paymentSplits
    .map((s) => s.memberSplitId)
    .filter(
      (id, idx, arr) => id !== user.data.user!.id && arr.indexOf(id) === idx
    );

  await Promise.allSettled(
    membersToNotify.map((memberId) =>
      Promise.all([
        createNotification({
          fromUserId: user.data.user!.id,
          toUserId: memberId,
          type: NotificationType.EXPENSE_INCLUSION,
          referenceId: expenseId
        }),
        sendPushNotification(memberId, NotificationType.EXPENSE_INCLUSION, {
          title: "New Expense",
          body: `You've been added to "${description}"`
        })
      ])
    )
  );

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
  withMetadata: boolean = false,
  filters?: {
    role?: "collects" | "pays";
    status?: "pending" | "requested" | "settled";
  }
) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const from = page * limit;
  const to = from + limit - 1;

  let query = supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(
      `id, created_at, group_id, expense_id, member:member_id!inner(id, email, phone, first_name, last_name, avatar), payer:payer_id!inner(id, email, phone, first_name, last_name, avatar), amount, status, expense:expense_id(description, currency)`,
      { count: withMetadata ? "exact" : undefined }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters?.role === "collects") {
    query = query.eq("payer_id", userId);
  } else if (filters?.role === "pays") {
    query = query.eq("member_id", userId);
  } else {
    query = query.or(`member_id.eq.${userId},payer_id.eq.${userId}`);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const expenseSplitResponse = await query;

  if (expenseSplitResponse.error) {
    throw expenseSplitResponse.error;
  }

  const normalize = (data: any[]) =>
    data.map((item) => {
      const expense = Array.isArray(item.expense)
        ? item.expense[0]
        : item.expense;
      return {
        ...item,
        member: Array.isArray(item.member) ? item.member[0] : item.member,
        payer: Array.isArray(item.payer) ? item.payer[0] : item.payer,
        expense_description: expense?.description ?? null,
        currency: expense?.currency ?? "PHP",
        expense: undefined
      };
    });

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
      `*, member:member_id!inner(id, email, phone, first_name, last_name, avatar), payer:payer_id!inner(id, email, phone, first_name, last_name, avatar), expense:expense_id(currency)`
    )
    .eq("expense_id", expenseId)
    .order("created_at", { ascending: false });

  if (paymentListResponse.error) {
    throw paymentListResponse.error;
  }

  return paymentListResponse.data.map((item) => {
    const expense = Array.isArray(item.expense)
      ? item.expense[0]
      : item.expense;
    return {
      ...item,
      member: Array.isArray(item.member) ? item.member[0] : item.member,
      payer: Array.isArray(item.payer) ? item.payer[0] : item.payer,
      currency: expense?.currency ?? "PHP",
      expense: undefined
    };
  }) as Payment[];
};

export const getStatsByUserId = async (userId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const toPayResponse = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select("amount, expense:expense_id(currency)")
    .eq("member_id", userId)
    .or(`status.eq.pending,status.eq.requested`);

  if (toPayResponse.error) {
    throw toPayResponse.error;
  }

  const toReceiveResponse = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select("amount, expense:expense_id(currency)")
    .eq("payer_id", userId)
    .or(`status.eq.pending,status.eq.requested`);

  if (toReceiveResponse.error) {
    throw toReceiveResponse.error;
  }

  const groupByCurrency = (data: { amount: number; expense: any }[]) => {
    const map: Record<string, number> = {};
    data.forEach((item) => {
      const expense = Array.isArray(item.expense)
        ? item.expense[0]
        : item.expense;
      const currency = expense?.currency ?? "PHP";
      map[currency] = (map[currency] ?? 0) + item.amount;
    });
    return Object.entries(map).map(([currency, amount]) => ({
      currency,
      amount
    }));
  };

  return {
    toPay: groupByCurrency(toPayResponse.data ?? []),
    toReceive: groupByCurrency(toReceiveResponse.data ?? [])
  };
};

export const getExpensesByGroupId = async (groupId: string) => {
  const { data, error } = await supabase
    .from(tables.EXPENSES_TBL)
    .select(
      `id, created_at, group_id, amount, description, status, currency, creator:creator_id!inner(id, email, phone, first_name, last_name, avatar)`
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
      "*, payer:payer_id!inner(id, email, phone, first_name, last_name, avatar), expense:expense_id(currency)"
    )
    .eq("expense_id", expenseId);

  if (error) {
    throw error;
  }

  return data.map((item) => {
    const expense = Array.isArray(item.expense)
      ? item.expense[0]
      : item.expense;
    return {
      ...item,
      payer: Array.isArray(item.payer) ? item.payer[0] : item.payer,
      currency: expense?.currency ?? "PHP",
      expense: undefined
    };
  }) as ExpensePayer[];
};

export const getMemberSplitsByExpenseId = async (expenseId: string) => {
  const { data, error } = await supabase
    .from(tables.MEMBER_SPLITS_TBL)
    .select(
      `*, member:member_id!inner(id, email, phone, first_name, last_name, avatar), expense:expense_id(currency)`
    )
    .eq("expense_id", expenseId);

  if (error) {
    throw error;
  }

  return data.map((item) => {
    const expense = Array.isArray(item.expense)
      ? item.expense[0]
      : item.expense;
    return {
      ...item,
      member: Array.isArray(item.member) ? item.member[0] : item.member,
      currency: expense?.currency ?? "PHP",
      expense: undefined
    };
  }) as MemberSplit[];
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
    .eq("id", expenseSplitId)
    .select("payer_id")
    .single();

  if (splitResponse.error) {
    throw splitResponse.error;
  }

  try {
    await Promise.all([
      createNotification({
        fromUserId: user.data.user.id,
        toUserId: splitResponse.data.payer_id,
        type: NotificationType.SETTLEMENT_REQUEST,
        referenceId: expenseSplitId
      }),
      sendPushNotification(
        splitResponse.data.payer_id,
        NotificationType.SETTLEMENT_REQUEST,
        {
          title: "Settlement Requested",
          body: "Someone is requesting to settle a payment with you"
        }
      )
    ]);
  } catch (err) {
    console.error("Failed to send payment request notification:", err);
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

export const rejectSettledRequest = async (expenseSplitId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const splitResponse = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .update({
      status: "pending",
      member_note: null,
      proof_of_payment: null,
      status_updated_at: new Date().toISOString()
    })
    .eq("id", expenseSplitId)
    .select("member_id")
    .single();

  if (splitResponse.error) {
    throw splitResponse.error;
  }

  try {
    await Promise.all([
      createNotification({
        fromUserId: user.data.user.id,
        toUserId: splitResponse.data.member_id,
        type: NotificationType.SETTLEMENT_REJECTED,
        referenceId: expenseSplitId
      }),
      sendPushNotification(
        splitResponse.data.member_id,
        NotificationType.SETTLEMENT_REJECTED,
        {
          title: "Settlement Rejected",
          body: "Your settlement request has been rejected"
        }
      )
    ]);
  } catch (err) {
    console.error("Failed to send payment rejected notification:", err);
  }

  return { success: true, message: "Settled request rejected successfully" };
};

export const markAsSettled = async (expensePayload: {
  note: string;
  receipt: ImagePickerSuccessResult | null;
  expenseSplitId: string;
  expenseId: string;
}) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }
  const { note, receipt, expenseSplitId, expenseId } = expensePayload;
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
    .eq("id", expenseSplitId)
    .select("member_id")
    .single();

  if (splitResponse.error) {
    throw splitResponse.error;
  }

  try {
    await Promise.all([
      createNotification({
        fromUserId: user.data.user.id,
        toUserId: splitResponse.data.member_id,
        type: NotificationType.SETTLEMENT_APPROVED,
        referenceId: expenseSplitId
      }),
      sendPushNotification(
        splitResponse.data.member_id,
        NotificationType.SETTLEMENT_APPROVED,
        {
          title: "Settlement Approved",
          body: "Your settlement request has been approved"
        }
      )
    ]);
  } catch (err) {
    console.error("Failed to send payment approved notification:", err);
  }

  const { data: allSplits, error: splitsError } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select("status")
    .eq("expense_id", expenseId);

  if (splitsError) throw splitsError;

  const allSettled =
    allSplits.length > 0 && allSplits.every((s) => s.status === "settled");

  if (allSettled) {
    const { error: expenseError } = await supabase
      .from(tables.EXPENSES_TBL)
      .update({ status: "completed" })
      .eq("id", expenseId);

    if (expenseError) throw expenseError;
  }

  return { success: true, message: "Marked as settled successfully" };
};

const PAYMENT_FIELDS = `*, member:member_id!inner(id, email, phone, first_name, last_name, avatar), payer:payer_id!inner(id, email, phone, first_name, last_name, avatar), expense:expense_id(description, currency)`;

const mapPaymentRows = (data: any[]): Payment[] =>
  data.map((item) => {
    const expense = Array.isArray(item.expense) ? item.expense[0] : item.expense;
    return {
      ...item,
      expense_description: expense?.description ?? null,
      currency: expense?.currency ?? "PHP",
      member: Array.isArray(item.member) ? item.member[0] : item.member,
      payer: Array.isArray(item.payer) ? item.payer[0] : item.payer,
      expense: undefined
    };
  }) as Payment[];

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
    .select(PAYMENT_FIELDS)
    .eq("group_id", groupId)
    .or(`member_id.eq.${userId},payer_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return mapPaymentRows(data);
};

export const getActivePaymentsByGroupAndUserId = async (
  groupId: string,
  userId: string
): Promise<Payment[]> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(PAYMENT_FIELDS)
    .eq("group_id", groupId)
    .or(`member_id.eq.${userId},payer_id.eq.${userId}`)
    .in("status", ["pending", "requested"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return mapPaymentRows(data);
};

const SETTLED_PAGE_SIZE = 20;

export const getSettledPaymentsByGroupAndUserId = async (
  groupId: string,
  userId: string,
  options: { cutoff?: Date | null; page?: number } = {}
): Promise<{ data: Payment[]; hasNext: boolean }> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { cutoff = null, page = 0 } = options;
  const from = page * SETTLED_PAGE_SIZE;
  const to = from + SETTLED_PAGE_SIZE - 1;

  let query = supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(PAYMENT_FIELDS, { count: "exact" })
    .eq("group_id", groupId)
    .or(`member_id.eq.${userId},payer_id.eq.${userId}`)
    .eq("status", "settled")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (cutoff) {
    query = query.gte("created_at", cutoff.toISOString());
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const totalPages = Math.ceil((count || 0) / SETTLED_PAGE_SIZE);
  return { data: mapPaymentRows(data), hasNext: page < totalPages - 1 };
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
