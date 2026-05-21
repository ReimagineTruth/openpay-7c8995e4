import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  rate: number; // rate relative to PI (1 PI = rate units)
}

export const PI_TO_USD = 1;
const PI_RATE_OVERRIDES: Record<string, number> = {
  USD: PI_TO_USD,
  EUR: 0.8429 * PI_TO_USD,
  GBP: 0.7344 * PI_TO_USD,
  AUD: 1.428 * PI_TO_USD,
  CAD: 1.362 * PI_TO_USD,
  JPY: 155.926 * PI_TO_USD,
  CNY: 6.901 * PI_TO_USD,
  CHF: 0.7786 * PI_TO_USD,
  SGD: 1.271 * PI_TO_USD,
  HKD: 7.816 * PI_TO_USD,
  INR: 90.599 * PI_TO_USD,
  BRL: 5.5745 * PI_TO_USD,
  MXN: 17.232 * PI_TO_USD,
  ZAR: 15.961 * PI_TO_USD,
  TRY: 43.645 * PI_TO_USD,
  PLN: 3.554 * PI_TO_USD,
  RON: 4.292 * PI_TO_USD,
  CZK: 20.443 * PI_TO_USD,
  NOK: 9.545 * PI_TO_USD,
  DKK: 6.298 * PI_TO_USD,
  SEK: 8.931 * PI_TO_USD,
  AED: 3.6725 * PI_TO_USD,
  SAR: 3.75 * PI_TO_USD,
  QAR: 3.641 * PI_TO_USD,
  KWD: 0.3066 * PI_TO_USD,
  BHD: 0.376992 * PI_TO_USD,
  OMR: 0.3845 * PI_TO_USD,
  JOD: 0.709 * PI_TO_USD,
  NGN: 1352 * PI_TO_USD,
  KES: 129 * PI_TO_USD,
  ETB: 155.05 * PI_TO_USD,
  GHS: 11.005 * PI_TO_USD,
  MAD: 9.139 * PI_TO_USD,
  RWF: 1453 * PI_TO_USD,
  XOF: 552.915 * PI_TO_USD,
  XAF: 552.915 * PI_TO_USD,
  ARS: 1482.94905 * PI_TO_USD,
  COP: 3670 * PI_TO_USD,
  PEN: 3.355 * PI_TO_USD,
  BOB: 6.9269 * PI_TO_USD,
  PYG: 6586 * PI_TO_USD,
  UYU: 38.557 * PI_TO_USD,
  DOP: 62.625 * PI_TO_USD,
  CRC: 495.723 * PI_TO_USD,
  GTQ: 7.672 * PI_TO_USD,
  NIO: 36.715 * PI_TO_USD,
  BSD: 1 * PI_TO_USD,
  BBD: 2 * PI_TO_USD,
  TTD: 6.776 * PI_TO_USD,
  CUP: 25.75 * PI_TO_USD,
  JMD: 156.252 * PI_TO_USD,
  PHP: 58.074 * PI_TO_USD,
  THB: 31.082 * PI_TO_USD,
  VND: 25961 * PI_TO_USD,
  IDR: 16817 * PI_TO_USD,
  PKR: 279.6 * PI_TO_USD,
  BDT: 122.205858 * PI_TO_USD,
  LKR: 309.457 * PI_TO_USD,
  NPR: 145.049 * PI_TO_USD,
  KHR: 4022 * PI_TO_USD,
  LAK: 21445 * PI_TO_USD,
  MMK: 2100 * PI_TO_USD,
  PGK: 4.299 * PI_TO_USD,
  MOP: 8.055 * PI_TO_USD,
  AFN: 66.207039 * PI_TO_USD,
  ALL: 83.2 * PI_TO_USD,
  AMD: 381.473652 * PI_TO_USD,
  AZN: 1.7 * PI_TO_USD,
  BAM: 1.683408 * PI_TO_USD,
  BIF: 2982.243336 * PI_TO_USD,
  BWP: 13.115 * PI_TO_USD,
  CDF: 2240 * PI_TO_USD,
  DJF: 177.5 * PI_TO_USD,
  ERN: 15 * PI_TO_USD,
  FJD: 2.191 * PI_TO_USD,
  GMD: 73.5 * PI_TO_USD,
  GNF: 8775 * PI_TO_USD,
  HTG: 130.977 * PI_TO_USD,
  KMF: 416 * PI_TO_USD,
  KYD: 0.8336 * PI_TO_USD,
  MGA: 4430 * PI_TO_USD,
  MRU: 39.9 * PI_TO_USD,
  MVR: 15.46 * PI_TO_USD,
  MWK: 1737 * PI_TO_USD,
  MZN: 63.91 * PI_TO_USD,
  NAD: 15.96 * PI_TO_USD,
  RSD: 98.934 * PI_TO_USD,
  SBD: 8.048 * PI_TO_USD,
  SLL: 20970 * PI_TO_USD,
  SOS: 571.5 * PI_TO_USD,
  SRD: 37.779 * PI_TO_USD,
  SSP: 130.26 * PI_TO_USD,
  STN: 20.95 * PI_TO_USD,
  SVC: 8.752 * PI_TO_USD,
  TJS: 9.418 * PI_TO_USD,
  TMT: 3.51 * PI_TO_USD,
  TND: 2.835 * PI_TO_USD,
  TOP: 2.408 * PI_TO_USD,
  TZS: 2600 * PI_TO_USD,
  VUV: 119.995 * PI_TO_USD,
};

const baseCurrencies: Currency[] = [
  { code: "OUSD", symbol: "$", name: "Open USD", flag: "OP", rate: 1 },
  { code: "OUSD_SOL", symbol: "$", name: "OUSD SOL", flag: "SOL", rate: 1 },
  { code: "PI", symbol: "\u03C0", name: "Pi", flag: "PI", rate: 1 },
  { code: "MRWN", symbol: "M", name: "MRWN", flag: "MR", rate: 0.5 },
  { code: "USD", symbol: "$", name: "US Dollar", flag: "\u{1F1FA}\u{1F1F8}", rate: 3.14 },
  { code: "EUR", symbol: "\u20AC", name: "Euro", flag: "\u{1F1EA}\u{1F1FA}", rate: 2.89 },
  { code: "GBP", symbol: "\u00A3", name: "British Pound", flag: "\u{1F1EC}\u{1F1E7}", rate: 2.48 },
  { code: "JPY", symbol: "\u00A5", name: "Japanese Yen", flag: "\u{1F1EF}\u{1F1F5}", rate: 471 },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", flag: "\u{1F1E8}\u{1F1E6}", rate: 4.24 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", flag: "\u{1F1E6}\u{1F1FA}", rate: 4.8 },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc", flag: "\u{1F1E8}\u{1F1ED}", rate: 2.79 },
  { code: "CNY", symbol: "\u00A5", name: "Chinese Yuan", flag: "\u{1F1E8}\u{1F1F3}", rate: 22.7 },
  { code: "INR", symbol: "\u20B9", name: "Indian Rupee", flag: "\u{1F1EE}\u{1F1F3}", rate: 261 },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso", flag: "\u{1F1F2}\u{1F1FD}", rate: 53.5 },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", flag: "\u{1F1E7}\u{1F1F7}", rate: 15.8 },
  { code: "KRW", symbol: "\u20A9", name: "South Korean Won", flag: "\u{1F1F0}\u{1F1F7}", rate: 4200 },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", flag: "\u{1F1F8}\u{1F1EC}", rate: 4.23 },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", flag: "\u{1F1ED}\u{1F1F0}", rate: 24.6 },
  { code: "SEK", symbol: "kr", name: "Swedish Krona", flag: "\u{1F1F8}\u{1F1EA}", rate: 33.5 },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone", flag: "\u{1F1F3}\u{1F1F4}", rate: 33.2 },
  { code: "DKK", symbol: "kr", name: "Danish Krone", flag: "\u{1F1E9}\u{1F1F0}", rate: 21.6 },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", flag: "\u{1F1F3}\u{1F1FF}", rate: 5.2 },
  { code: "ZAR", symbol: "R", name: "South African Rand", flag: "\u{1F1FF}\u{1F1E6}", rate: 59.8 },
  { code: "TRY", symbol: "\u20BA", name: "Turkish Lira", flag: "\u{1F1F9}\u{1F1F7}", rate: 101 },
  { code: "AED", symbol: "\u062F.\u0625", name: "UAE Dirham", flag: "\u{1F1E6}\u{1F1EA}", rate: 11.5238 },
  { code: "SAR", symbol: "\uFDFC", name: "Saudi Riyal", flag: "\u{1F1F8}\u{1F1E6}", rate: 11.775 },
  { code: "PLN", symbol: "z\u0142", name: "Polish Zloty", flag: "\u{1F1F5}\u{1F1F1}", rate: 12.5 },
  { code: "THB", symbol: "\u0E3F", name: "Thai Baht", flag: "\u{1F1F9}\u{1F1ED}", rate: 113 },
  { code: "PHP", symbol: "\u20B1", name: "Philippine Peso", flag: "\u{1F1F5}\u{1F1ED}", rate: 175.84 },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", flag: "\u{1F1EE}\u{1F1E9}", rate: 49200 },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", flag: "\u{1F1F2}\u{1F1FE}", rate: 14.9 },
  { code: "CZK", symbol: "K\u010D", name: "Czech Koruna", flag: "\u{1F1E8}\u{1F1FF}", rate: 73.8 },
  { code: "CLP", symbol: "CL$", name: "Chilean Peso", flag: "\u{1F1E8}\u{1F1F1}", rate: 2940 },
  { code: "NGN", symbol: "\u20A6", name: "Nigerian Naira", flag: "\u{1F1F3}\u{1F1EC}", rate: 4900 },
];

const additionalCurrencies: Currency[] = [
  { code: "ARS", symbol: "$", name: "Argentine Peso", flag: "\u{1F30E}", rate: 4554.3 },
  { code: "COP", symbol: "$", name: "Colombian Peso", flag: "\u{1F30E}", rate: 11830.14 },
  { code: "PEN", symbol: "S/", name: "Peruvian Sol", flag: "\u{1F30E}", rate: 11.68 },
  { code: "BOB", symbol: "Bs", name: "Bolivian Boliviano", flag: "\u{1F30E}", rate: 21.75 },
  { code: "UYU", symbol: "$U", name: "Uruguayan Peso", flag: "\u{1F30E}", rate: 121.66 },
  { code: "PYG", symbol: "\u20B2", name: "Paraguayan Guarani", flag: "\u{1F30E}", rate: 20264.42 },
  { code: "VES", symbol: "Bs.S", name: "Venezuelan Bolivar", flag: "\u{1F30E}", rate: 113.04 },
  { code: "GTQ", symbol: "Q", name: "Guatemalan Quetzal", flag: "\u{1F30E}", rate: 24.06 },
  { code: "HNL", symbol: "L", name: "Honduran Lempira", flag: "\u{1F30E}", rate: 78.5 },
  { code: "NIO", symbol: "C$", name: "Nicaraguan Cordoba", flag: "\u{1F30E}", rate: 114.4 },
  { code: "CRC", symbol: "\u20A1", name: "Costa Rican Colon", flag: "\u{1F30E}", rate: 1568.16 },
  { code: "PAB", symbol: "B/.", name: "Panamanian Balboa", flag: "\u{1F30E}", rate: 3.14 },
  { code: "DOP", symbol: "RD$", name: "Dominican Peso", flag: "\u{1F30E}", rate: 196.77 },
  { code: "CUP", symbol: "$", name: "Cuban Peso", flag: "\u{1F30E}", rate: 80.85 },
  { code: "JMD", symbol: "J$", name: "Jamaican Dollar", flag: "\u{1F30E}", rate: 489.63 },
  { code: "TTD", symbol: "TT$", name: "Trinidad & Tobago Dollar", flag: "\u{1F30E}", rate: 27.07 },
  { code: "BBD", symbol: "Bds$", name: "Barbadian Dollar", flag: "\u{1F30E}", rate: 6.28 },
  { code: "BSD", symbol: "B$", name: "Bahamian Dollar", flag: "\u{1F30E}", rate: 3.14 },
  { code: "XCD", symbol: "EC$", name: "East Caribbean Dollar", flag: "\u{1F30E}", rate: 8.48 },
  { code: "HUF", symbol: "Ft", name: "Hungarian Forint", flag: "\u{1F30D}", rate: 1210 },
  { code: "RON", symbol: "lei", name: "Romanian Leu", flag: "\u{1F30D}", rate: 14.2 },
  { code: "BGN", symbol: "lv", name: "Bulgarian Lev", flag: "\u{1F30D}", rate: 5.67 },
  { code: "RSD", symbol: "din", name: "Serbian Dinar", flag: "\u{1F30D}", rate: 338 },
  { code: "MKD", symbol: "den", name: "Macedonian Denar", flag: "\u{1F30D}", rate: 178.5 },
  { code: "ALL", symbol: "L", name: "Albanian Lek", flag: "\u{1F30D}", rate: 300 },
  { code: "ISK", symbol: "kr", name: "Icelandic Krona", flag: "\u{1F30D}", rate: 438 },
  { code: "UAH", symbol: "\u20B4", name: "Ukrainian Hryvnia", flag: "\u{1F30D}", rate: 124 },
  { code: "BYN", symbol: "Br", name: "Belarusian Ruble", flag: "\u{1F30D}", rate: 10.3 },
  { code: "RUB", symbol: "\u20BD", name: "Russian Ruble", flag: "\u{1F30D}", rate: 305 },
  { code: "BAM", symbol: "KM", name: "Bosnia Convertible Mark", flag: "\u{1F30D}", rate: 5.65 },
  { code: "MDL", symbol: "L", name: "Moldovan Leu", flag: "\u{1F30D}", rate: 55.5 },
  { code: "PKR", symbol: "\u20A8", name: "Pakistani Rupee", flag: "\u{1F30F}", rate: 874 },
  { code: "BDT", symbol: "\u09F3", name: "Bangladeshi Taka", flag: "\u{1F30F}", rate: 369 },
  { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee", flag: "\u{1F30F}", rate: 980 },
  { code: "NPR", symbol: "\u20A8", name: "Nepalese Rupee", flag: "\u{1F30F}", rate: 418 },
  { code: "VND", symbol: "\u20AB", name: "Vietnamese Dong", flag: "\u{1F30F}", rate: 78500 },
  { code: "KHR", symbol: "\u17DB", name: "Cambodian Riel", flag: "\u{1F30F}", rate: 12850 },
  { code: "LAK", symbol: "\u20AD", name: "Lao Kip", flag: "\u{1F30F}", rate: 65400 },
  { code: "MMK", symbol: "K", name: "Myanmar Kyat", flag: "\u{1F30F}", rate: 6600 },
  { code: "BND", symbol: "B$", name: "Brunei Dollar", flag: "\u{1F30F}", rate: 4.23 },
  { code: "MOP", symbol: "MOP$", name: "Macau Pataca", flag: "\u{1F30F}", rate: 25.3 },
  { code: "TWD", symbol: "NT$", name: "Taiwan Dollar", flag: "\u{1F30F}", rate: 99.5 },
  { code: "MNT", symbol: "\u20AE", name: "Mongolian Tugrik", flag: "\u{1F30F}", rate: 10850 },
  { code: "KZT", symbol: "\u20B8", name: "Kazakhstani Tenge", flag: "\u{1F30F}", rate: 1470 },
  { code: "UZS", symbol: "so'm", name: "Uzbekistani Som", flag: "\u{1F30F}", rate: 39700 },
  { code: "TJS", symbol: "SM", name: "Tajikistani Somoni", flag: "\u{1F30F}", rate: 34.3 },
  { code: "TMT", symbol: "m", name: "Turkmenistani Manat", flag: "\u{1F30F}", rate: 11 },
  { code: "KGS", symbol: "\u20C0", name: "Kyrgyzstani Som", flag: "\u{1F30F}", rate: 279 },
  { code: "IRR", symbol: "\uFDFC", name: "Iranian Rial", flag: "\u{1F30F}", rate: 1 },
  { code: "IQD", symbol: "\u0639.\u062F", name: "Iraqi Dinar", flag: "\u{1F30F}", rate: 1 },
  { code: "QAR", symbol: "\uFDFC", name: "Qatari Riyal", flag: "\u{1F30F}", rate: 1 },
  { code: "KWD", symbol: "\u062F.\u0643", name: "Kuwaiti Dinar", flag: "\u{1F30F}", rate: 1 },
  { code: "OMR", symbol: "\uFDFC", name: "Omani Rial", flag: "\u{1F30F}", rate: 1 },
  { code: "BHD", symbol: ".\u062F.\u0628", name: "Bahraini Dinar", flag: "\u{1F30F}", rate: 1 },
  { code: "ILS", symbol: "\u20AA", name: "Israeli Shekel", flag: "\u{1F30F}", rate: 1 },
  { code: "JOD", symbol: "\u062F.\u0627", name: "Jordanian Dinar", flag: "\u{1F30F}", rate: 1 },
  { code: "LBP", symbol: "L\u00A3", name: "Lebanese Pound", flag: "\u{1F30F}", rate: 1 },
  { code: "SYP", symbol: "S\u00A3", name: "Syrian Pound", flag: "\u{1F30F}", rate: 1 },
  { code: "YER", symbol: "\uFDFC", name: "Yemeni Rial", flag: "\u{1F30F}", rate: 1 },
  { code: "AFN", symbol: "\u060B", name: "Afghan Afghani", flag: "\u{1F30F}", rate: 1 },
  { code: "EGP", symbol: "\u00A3", name: "Egyptian Pound", flag: "\u{1F30D}", rate: 97 },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling", flag: "\u{1F30D}", rate: 492 },
  { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling", flag: "\u{1F30D}", rate: 8150 },
  { code: "UGX", symbol: "USh", name: "Ugandan Shilling", flag: "\u{1F30D}", rate: 11800 },
  { code: "ETB", symbol: "Br", name: "Ethiopian Birr", flag: "\u{1F30D}", rate: 178 },
  { code: "GHS", symbol: "\u20B5", name: "Ghanaian Cedi", flag: "\u{1F30D}", rate: 43.5 },
  { code: "ZMW", symbol: "ZK", name: "Zambian Kwacha", flag: "\u{1F30D}", rate: 82 },
  { code: "MWK", symbol: "MK", name: "Malawian Kwacha", flag: "\u{1F30D}", rate: 1 },
  { code: "MZN", symbol: "MT", name: "Mozambican Metical", flag: "\u{1F30D}", rate: 1 },
  { code: "BWP", symbol: "P", name: "Botswana Pula", flag: "\u{1F30D}", rate: 42 },
  { code: "NAD", symbol: "N$", name: "Namibian Dollar", flag: "\u{1F30D}", rate: 1 },
  { code: "SZL", symbol: "E", name: "Swazi Lilangeni", flag: "\u{1F30D}", rate: 1 },
  { code: "LSL", symbol: "L", name: "Lesotho Loti", flag: "\u{1F30D}", rate: 1 },
  { code: "AOA", symbol: "Kz", name: "Angolan Kwanza", flag: "\u{1F30D}", rate: 1 },
  { code: "CDF", symbol: "FC", name: "Congolese Franc", flag: "\u{1F30D}", rate: 1 },
  { code: "RWF", symbol: "RF", name: "Rwandan Franc", flag: "\u{1F30D}", rate: 1 },
  { code: "BIF", symbol: "FBu", name: "Burundian Franc", flag: "\u{1F30D}", rate: 1 },
  { code: "DJF", symbol: "Fdj", name: "Djiboutian Franc", flag: "\u{1F30D}", rate: 1 },
  { code: "SOS", symbol: "Sh", name: "Somali Shilling", flag: "\u{1F30D}", rate: 1 },
  { code: "SDG", symbol: "\u00A3", name: "Sudanese Pound", flag: "\u{1F30D}", rate: 1 },
  { code: "SSP", symbol: "\u00A3", name: "South Sudanese Pound", flag: "\u{1F30D}", rate: 1 },
  { code: "DZD", symbol: "\u062F\u062C", name: "Algerian Dinar", flag: "\u{1F30D}", rate: 423 },
  { code: "MAD", symbol: "\u062F.\u0645.", name: "Moroccan Dirham", flag: "\u{1F30D}", rate: 31.5 },
  { code: "TND", symbol: "\u062F.\u062A", name: "Tunisian Dinar", flag: "\u{1F30D}", rate: 9.75 },
  { code: "LYD", symbol: "LD", name: "Libyan Dinar", flag: "\u{1F30D}", rate: 1 },
  { code: "XOF", symbol: "CFA", name: "West African CFA Franc", flag: "\u{1F30D}", rate: 1890 },
  { code: "XAF", symbol: "FCFA", name: "Central African CFA Franc", flag: "\u{1F30D}", rate: 1890 },
  { code: "MUR", symbol: "\u20A8", name: "Mauritian Rupee", flag: "\u{1F30D}", rate: 1 },
  { code: "SCR", symbol: "\u20A8", name: "Seychellois Rupee", flag: "\u{1F30D}", rate: 1 },
  { code: "PGK", symbol: "K", name: "Papua New Guinea Kina", flag: "\u{1F30F}", rate: 11.5 },
  { code: "FJD", symbol: "FJ$", name: "Fijian Dollar", flag: "\u{1F30F}", rate: 7.1 },
  { code: "SBD", symbol: "SI$", name: "Solomon Islands Dollar", flag: "\u{1F30F}", rate: 1 },
  { code: "VUV", symbol: "VT", name: "Vanuatu Vatu", flag: "\u{1F30F}", rate: 1 },
  { code: "WST", symbol: "WS$", name: "Samoan Tala", flag: "\u{1F30F}", rate: 1 },
  { code: "TOP", symbol: "T$", name: "Tongan Pa'anga", flag: "\u{1F30F}", rate: 1 },
  { code: "AMD", symbol: "\u058F", name: "Armenian Dram", flag: "AM", rate: 1 },
  { code: "AZN", symbol: "\u20BC", name: "Azerbaijani Manat", flag: "AZ", rate: 1 },
  { code: "ERN", symbol: "Nfk", name: "Eritrean Nakfa", flag: "ER", rate: 1 },
  { code: "GMD", symbol: "D", name: "Gambian Dalasi", flag: "GM", rate: 1 },
  { code: "GNF", symbol: "FG", name: "Guinean Franc", flag: "GN", rate: 1 },
  { code: "HTG", symbol: "G", name: "Haitian Gourde", flag: "HT", rate: 1 },
  { code: "KMF", symbol: "CF", name: "Comorian Franc", flag: "KM", rate: 1 },
  { code: "KYD", symbol: "$", name: "Cayman Islands Dollar", flag: "KY", rate: 1 },
  { code: "MGA", symbol: "Ar", name: "Malagasy Ariary", flag: "MG", rate: 1 },
  { code: "MRU", symbol: "UM", name: "Mauritanian Ouguiya", flag: "MR", rate: 1 },
  { code: "MVR", symbol: "Rf", name: "Maldivian Rufiyaa", flag: "MV", rate: 1 },
  { code: "SLL", symbol: "Le", name: "Sierra Leonean Leone", flag: "SL", rate: 1 },
  { code: "SRD", symbol: "$", name: "Surinamese Dollar", flag: "SR", rate: 1 },
  { code: "STN", symbol: "Db", name: "S\u00E3o Tom\u00E9 Dobra", flag: "ST", rate: 1 },
  { code: "SVC", symbol: "\u20A1", name: "Salvadoran Col\u00F3n", flag: "SV", rate: 1 },
];

const currencyFlagCountryCode: Record<string, string> = {
  USD: "US", CAD: "CA", MXN: "MX", BRL: "BR", ARS: "AR", CLP: "CL", COP: "CO", PEN: "PE", BOB: "BO", UYU: "UY",
  PYG: "PY", VES: "VE", GTQ: "GT", HNL: "HN", NIO: "NI", CRC: "CR", PAB: "PA", DOP: "DO", CUP: "CU", JMD: "JM",
  TTD: "TT", BBD: "BB", BSD: "BS", XCD: "AG",
  EUR: "EU", GBP: "GB", CHF: "CH", SEK: "SE", NOK: "NO", DKK: "DK", PLN: "PL", CZK: "CZ", HUF: "HU", RON: "RO",
  BGN: "BG", RSD: "RS", MKD: "MK", ALL: "AL", ISK: "IS", UAH: "UA", BYN: "BY", RUB: "RU", TRY: "TR", BAM: "BA",
  MDL: "MD",
  JPY: "JP", CNY: "CN", KRW: "KR", INR: "IN", PKR: "PK", BDT: "BD", LKR: "LK", NPR: "NP", IDR: "ID", MYR: "MY",
  THB: "TH", PHP: "PH", SGD: "SG", VND: "VN", KHR: "KH", LAK: "LA", MMK: "MM", BND: "BN", HKD: "HK", MOP: "MO",
  TWD: "TW", MNT: "MN", KZT: "KZ", UZS: "UZ", TJS: "TJ", TMT: "TM", KGS: "KG", IRR: "IR", IQD: "IQ", SAR: "SA",
  AED: "AE", QAR: "QA", KWD: "KW", OMR: "OM", BHD: "BH", ILS: "IL", JOD: "JO", LBP: "LB", SYP: "SY", YER: "YE",
  AFN: "AF",
  ZAR: "ZA", EGP: "EG", NGN: "NG", KES: "KE", TZS: "TZ", UGX: "UG", ETB: "ET", GHS: "GH", ZMW: "ZM", MWK: "MW",
  MZN: "MZ", BWP: "BW", NAD: "NA", SZL: "SZ", LSL: "LS", AOA: "AO", CDF: "CD", RWF: "RW", BIF: "BI", DJF: "DJ",
  SOS: "SO", SDG: "SD", SSP: "SS", DZD: "DZ", MAD: "MA", TND: "TN", LYD: "LY", XOF: "SN", XAF: "CM", MUR: "MU",
  SCR: "SC",
  AUD: "AU", NZD: "NZ", PGK: "PG", FJD: "FJ", SBD: "SB", VUV: "VU", WST: "WS", TOP: "TO",
};

const countryCodeToFlag = (countryCode: string) =>
  countryCode
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");

const isTwoLetterCountryCode = (value: string) => /^[A-Za-z]{2}$/.test(value);
const isGlobeEmoji = (value: string) => ["\u{1F30D}", "\u{1F30E}", "\u{1F30F}", "\u{1F310}"].includes(value);

const normalizeCurrencyFlag = (currencyCode: string, rawFlag?: string | null) => {
  if (currencyCode === "PI") return "PI";

  const candidate = String(rawFlag || "").trim();
  if (isTwoLetterCountryCode(candidate)) {
    return countryCodeToFlag(candidate.toUpperCase());
  }

  if (candidate && !isGlobeEmoji(candidate)) {
    return candidate;
  }

  const mappedCountryCode = currencyFlagCountryCode[currencyCode];
  if (mappedCountryCode) {
    return countryCodeToFlag(mappedCountryCode);
  }

  const inferredCountryCode = currencyCode.slice(0, 2);
  if (isTwoLetterCountryCode(inferredCountryCode)) {
    return countryCodeToFlag(inferredCountryCode);
  }

  return "\u{1F3F3}";
};

const existingCodes = new Set(baseCurrencies.map((currency) => currency.code));
const mergedCurrencies: Currency[] = [
  ...baseCurrencies,
  ...additionalCurrencies.filter(
    (currency) =>
      !existingCodes.has(currency.code) &&
      (currency.rate !== 1 || typeof PI_RATE_OVERRIDES[currency.code] === "number"),
  ),
];
export const currencies: Currency[] = mergedCurrencies.map((currency) => {
  const overrideRate = PI_RATE_OVERRIDES[currency.code];
  return {
    ...currency,
    rate: typeof overrideRate === "number" ? overrideRate : currency.rate,
    flag: normalizeCurrencyFlag(currency.code, currency.flag),
  };
});

interface CurrencyContextType {
  currencies: Currency[];
  currency: Currency;
  ratesUpdatedAt: string | null;
  liveRateClosed: boolean;
  setCurrency: (c: Currency) => void;
  convert: (usdAmount: number) => number;
  format: (usdAmount: number) => string;
  formatCompact: (amount: number, symbol?: string) => string;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currencies,
  currency: currencies[0],
  ratesUpdatedAt: null,
  liveRateClosed: false,
  setCurrency: () => {},
  convert: (a) => a,
  format: (a) => `$${a.toFixed(2)}`,
  formatCompact: (a, symbol) => `${symbol || '$'}${a >= 1000 ? a.toLocaleString(undefined, { notation: 'compact', compactDisplay: 'short', minimumFractionDigits: 2, maximumFractionDigits: 2 }) : a.toFixed(2)}`,
});

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [availableCurrencies, setAvailableCurrencies] = useState<Currency[]>(currencies);
  const [currency, setCurrencyState] = useState<Currency>(currencies[0]);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(null);
  const [liveRateClosed, setLiveRateClosed] = useState(false);
  const useStaticPiRates = true;

  useEffect(() => {
    let mounted = true;
    const LIVE_SYNC_KEY = "openpay_last_fx_sync_at";
    const LIVE_SYNC_MIN_INTERVAL_MS = 60_000;

    const shouldAttemptFxSync = () => {
      if (typeof window === "undefined") return false;
      const disabled = String(import.meta.env.VITE_DISABLE_FX_SYNC || "").toLowerCase() === "true";
      if (disabled) return false;
      const { hostname, protocol } = window.location;
      if (hostname === "localhost" || hostname === "127.0.0.1") return false;
      if (protocol !== "https:") return false;
      return true;
    };

    const maybeSyncLiveRates = async () => {
      try {
        if (!shouldAttemptFxSync()) return;
        const now = Date.now();
        const rawLast = typeof window !== "undefined" ? window.localStorage.getItem(LIVE_SYNC_KEY) : null;
        const last = rawLast ? Number(rawLast) : 0;
        if (Number.isFinite(last) && now - last < LIVE_SYNC_MIN_INTERVAL_MS) return;

        const { error } = await supabase.functions.invoke("fx-rates-sync");
        if (!error && typeof window !== "undefined") {
          window.localStorage.setItem(LIVE_SYNC_KEY, String(now));
        }
      } catch {
        // Keep conversion functional even if sync fails.
      }
    };

    const refreshRates = async () => {
      if (useStaticPiRates) {
        setAvailableCurrencies(currencies);
        setRatesUpdatedAt(null);
        setCurrencyState((prev) => currencies.find((c) => c.code === prev.code) ?? currencies[0]);
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      await maybeSyncLiveRates();

      const { data, error } = await supabase
        .from("supported_currencies")
        .select("iso_code, display_name, symbol, flag, usd_rate, is_active, updated_at")
        .eq("is_active", true);

      if (error || !data || !mounted) return;

      const dbRates = new Map(data.map((row) => [row.iso_code, Number(row.usd_rate || 1)]));

      const merged = currencies.map((fallback) => {
        const usdRate = dbRates.get(fallback.code);
        if (usdRate === undefined) {
          return {
            ...fallback,
            flag: normalizeCurrencyFlag(fallback.code, fallback.flag),
            rate: fallback.rate,
          };
        }
        const piRate = fallback.code === "PI" ? 1 : Number(usdRate || 1) * PI_TO_USD;
        return {
          ...fallback,
          flag: normalizeCurrencyFlag(fallback.code, fallback.flag),
          rate: piRate,
        };
      });
      const seen = new Set(merged.map((c) => c.code));
      const extras = data
        .filter((row) => !seen.has(row.iso_code))
        .map((row) => ({
          code: row.iso_code,
          name: row.display_name,
          symbol: row.symbol,
          flag: normalizeCurrencyFlag(row.iso_code, row.flag),
          rate: row.iso_code === "PI" ? 1 : Number(row.usd_rate || 1) * PI_TO_USD,
        } satisfies Currency));
      const nextCurrencies = [...merged, ...extras];
      const latestUpdate = data
        .map((row) => row.updated_at)
        .filter((value): value is string => typeof value === "string")
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

      setAvailableCurrencies(nextCurrencies);
      setRatesUpdatedAt(latestUpdate);
      setCurrencyState((prev) => nextCurrencies.find((c) => c.code === prev.code) ?? nextCurrencies[0]);
    };

    refreshRates();
    const interval = window.setInterval(refreshRates, 60_000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const setCurrency = (nextCurrency: Currency) => {
    setCurrencyState(availableCurrencies.find((c) => c.code === nextCurrency.code) ?? nextCurrency);
  };

  const convert = (usdAmount: number) => {
    const piAmount = usdAmount / PI_TO_USD;
    return piAmount * currency.rate;
  };

  const format = (usdAmount: number) => {
    const converted = convert(usdAmount);
    // Use compact notation for large numbers (>= 1,000)
    if (converted >= 1000) {
      return `${currency.symbol}${converted.toLocaleString(undefined, { 
        notation: 'compact',
        compactDisplay: 'short',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2 
      })}`;
    }
    // Use standard formatting for smaller numbers
    return `${currency.symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCompact = (amount: number, symbol?: string) => {
    if (amount >= 1000) {
      return `${symbol || currency.symbol}${amount.toLocaleString(undefined, { 
        notation: 'compact',
        compactDisplay: 'short',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2 
      })}`;
    }
    // Use standard formatting for smaller numbers
    return `${symbol || currency.symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const contextValue = useMemo(
    () => ({ currencies: availableCurrencies, currency, ratesUpdatedAt, liveRateClosed, setCurrency, convert, format, formatCompact }),
    [availableCurrencies, currency, ratesUpdatedAt, liveRateClosed],
  );

  return (
    <CurrencyContext.Provider value={contextValue}>
      {children}
    </CurrencyContext.Provider>
  );
};


