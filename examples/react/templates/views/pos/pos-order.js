import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { MoneyAmount } from "../../components/MoneyAmount";
export function Body({ items, tax, total, paymentMethod }) {
    const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.qty, 0), [items]);
    return (_jsxs("section", { className: "pos-body font-mono text-sm", children: [_jsx("div", { className: "divide-y divide-dashed divide-slate-300", children: items.map((item, i) => (_jsxs("div", { className: "py-1", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: item.name }), _jsx(MoneyAmount, { amount: item.price * item.qty })] }), _jsxs("div", { className: "text-xs text-slate-500", children: [item.qty, " \u00D7", " ", _jsx(MoneyAmount, { amount: item.price })] })] }, i))) }), _jsxs("div", { className: "border-t-2 border-dashed border-slate-800 mt-2 pt-2 space-y-1", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Subtotal" }), _jsx(MoneyAmount, { amount: subtotal })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Tax" }), _jsx(MoneyAmount, { amount: tax })] }), _jsxs("div", { className: "flex justify-between font-bold text-base", children: [_jsx("span", { children: "TOTAL" }), _jsx(MoneyAmount, { amount: total, bold: true })] }), _jsxs("div", { className: "flex justify-between text-xs text-slate-500", children: [_jsx("span", { children: "Paid via" }), _jsx("span", { children: paymentMethod })] })] })] }));
}
export function Header({ store, address, orderNumber, date, cashier, }) {
    return (_jsxs("header", { className: "pos-header text-center border-b-2 border-dashed border-slate-800 pt-2 pb-2 mb-2", children: [_jsx("div", { className: "text-lg font-bold tracking-wide", children: store }), _jsx("div", { className: "text-xs", children: address }), _jsx("div", { className: "text-sm font-semibold mt-1", children: "ORDER RECEIPT" }), _jsxs("div", { className: "text-xs mt-1", children: ["#", orderNumber, " \u00B7 ", date] }), _jsxs("div", { className: "text-xs", children: ["Cashier: ", cashier] })] }));
}
export function Footer({ thankYou, returnPolicy }) {
    return (_jsxs("footer", { className: "pos-footer text-center text-xs text-slate-500 border-t-2 border-dashed border-slate-800 pt-2 mt-2 pb-2 space-y-1", children: [_jsx("div", { children: thankYou }), _jsx("div", { children: returnPolicy })] }));
}
