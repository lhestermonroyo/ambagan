import SettlementPaymentSheet, { type SettlementPaymentSheetProps } from "./SettlementPaymentSheet";

export default function RequestSettledSheet(props: SettlementPaymentSheetProps) {
  return <SettlementPaymentSheet key={`${props.payment.id}:${props.isOpen}`} {...props} />;
}
