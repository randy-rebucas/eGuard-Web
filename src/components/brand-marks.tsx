import { useId } from "react";

/* Platform and browser marks for marketing illustrations. Edge and Firefox are the official logos;
   the others are simplified. Gradient ids come from useId, so a mark can appear any number of times on one page. */

export function ChromeMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 24 4.95 13A22 22 0 0 1 43.05 13Z" fill="#EA4335" />
      <path d="M24 24 43.05 13A22 22 0 0 1 24 46Z" fill="#FBBC04" />
      <path d="M24 24 24 46A22 22 0 0 1 4.95 13Z" fill="#34A853" />
      <circle cx="24" cy="24" r="10" fill="#fff" /><circle cx="24" cy="24" r="7.8" fill="#4285F4" />
    </svg>
  );
}

export function EdgeMark() {
  const id = useId();
  return (
    <svg aria-hidden="true" viewBox="0 0 27600 27600">
      <defs>
        <linearGradient id={`${id}a`} gradientUnits="userSpaceOnUse" />
        <linearGradient id={`${id}b`} x1="6870" x2="24704" y1="18705" y2="18705" href={`#${id}a`}><stop offset="0" stopColor="#0c59a4" /><stop offset="1" stopColor="#114a8b" /></linearGradient>
        <linearGradient id={`${id}c`} x1="16272" x2="5133" y1="10968" y2="23102" href={`#${id}a`}><stop offset="0" stopColor="#1b9de2" /><stop offset=".16" stopColor="#1595df" /><stop offset=".67" stopColor="#0680d7" /><stop offset="1" stopColor="#0078d4" /></linearGradient>
        <radialGradient id={`${id}d`} cx="16720" cy="18747" r="9538" href={`#${id}a`}><stop offset=".72" stopOpacity="0" /><stop offset=".95" stopOpacity=".53" /><stop offset="1" /></radialGradient>
        <radialGradient id={`${id}e`} cx="7130" cy="19866" r="14324" gradientTransform="matrix(.14843 -.98892 .79688 .1196 -8759 25542)" href={`#${id}a`}><stop offset=".76" stopOpacity="0" /><stop offset=".95" stopOpacity=".5" /><stop offset="1" /></radialGradient>
        <radialGradient id={`${id}f`} cx="2523" cy="4680" r="20243" gradientTransform="matrix(-.03715 .99931 -2.12836 -.07913 13579 3530)" href={`#${id}a`}><stop offset="0" stopColor="#35c1f1" /><stop offset=".11" stopColor="#34c1ed" /><stop offset=".23" stopColor="#2fc2df" /><stop offset=".31" stopColor="#2bc3d2" /><stop offset=".67" stopColor="#36c752" /></radialGradient>
        <radialGradient id={`${id}g`} cx="24247" cy="7758" r="9734" gradientTransform="matrix(.28109 .95968 -.78353 .22949 24510 -16292)" href={`#${id}a`}><stop offset="0" stopColor="#66eb6e" /><stop offset="1" stopColor="#66eb6e" stopOpacity="0" /></radialGradient>
        <path id={`${id}h`} d="M24105 20053a9345 9345 0 01-1053 472 10202 10202 0 01-3590 646c-4732 0-8855-3255-8855-7432 0-1175 680-2193 1643-2729-4280 180-5380 4640-5380 7253 0 7387 6810 8137 8276 8137 791 0 1984-230 2704-456l130-44a12834 12834 0 006660-5282c220-350-168-757-535-565z" />
        <path id={`${id}i`} d="M11571 25141a7913 7913 0 01-2273-2137 8145 8145 0 01-1514-4740 8093 8093 0 013093-6395 8082 8082 0 011373-859c312-148 846-414 1554-404a3236 3236 0 012569 1297 3184 3184 0 01636 1866c0-21 2446-7960-8005-7960-4390 0-8004 4166-8004 7820 0 2319 538 4170 1212 5604a12833 12833 0 007684 6757 12795 12795 0 003908 610c1414 0 2774-233 4045-656a7575 7575 0 01-6278-803z" />
        <path id={`${id}j`} d="M16231 15886c-80 105-330 250-330 566 0 260 170 512 472 723 1438 1003 4149 868 4156 868a5954 5954 0 003027-839 6147 6147 0 001133-850 6180 6180 0 001910-4437c26-2242-796-3732-1133-4392-2120-4141-6694-6525-11668-6525-7011 0-12703 5635-12798 12620 47-3654 3679-6605 7996-6605 350 0 2346 34 4200 1007 1634 858 2490 1894 3086 2921 618 1067 728 2415 728 2952s-271 1333-780 1990z" />
      </defs>
      <use fill={`url(#${id}b)`} href={`#${id}h`} />
      <use fill={`url(#${id}d)`} opacity=".35" href={`#${id}h`} />
      <use fill={`url(#${id}c)`} href={`#${id}i`} />
      <use fill={`url(#${id}e)`} opacity=".4" href={`#${id}i`} />
      <use fill={`url(#${id}f)`} href={`#${id}j`} />
      <use fill={`url(#${id}g)`} href={`#${id}j`} />
    </svg>
  );
}

export function FirefoxMark() {
  const id = useId();
  return (
    <svg aria-hidden="true" viewBox="0 0 51500 51500">
      <defs>
        <radialGradient id={`${id}b`} cx="87.4%" cy="-12.9%" r="128%" gradientTransform="matrix(.8 0 0 1 .18 .13)"><stop offset=".13" stopColor="#ffbd4f" /><stop offset=".28" stopColor="#ff980e" /><stop offset=".47" stopColor="#ff3750" /><stop offset=".78" stopColor="#eb0878" /><stop offset=".86" stopColor="#e50080" /></radialGradient>
        <radialGradient id={`${id}d`} cx="49%" cy="40%" r="128%" gradientTransform="matrix(.82 0 0 1 .09 0)"><stop offset=".3" stopColor="#960e18" /><stop offset=".35" stopColor="#b11927" stopOpacity=".74" /><stop offset=".43" stopColor="#db293d" stopOpacity=".34" /><stop offset=".5" stopColor="#f5334b" stopOpacity=".1" /><stop offset=".53" stopColor="#ff3750" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}e`} cx="48%" cy="-12%" r="140%"><stop offset=".13" stopColor="#fff44f" /><stop offset=".53" stopColor="#ff980e" /></radialGradient>
        <radialGradient id={`${id}f`} cx="22.76%" cy="110.11%" r="100%"><stop offset=".35" stopColor="#3a8ee6" /><stop offset=".67" stopColor="#9059ff" /><stop offset="1" stopColor="#c139e6" /></radialGradient>
        <radialGradient id={`${id}h`} cx="52%" cy="33%" r="59%" gradientTransform="scale(.9 1)"><stop offset=".21" stopColor="#9059ff" stopOpacity="0" /><stop offset=".97" stopColor="#6e008b" stopOpacity=".6" /></radialGradient>
        <radialGradient id={`${id}i`} cx="210%" cy="-100%" r="290%"><stop offset=".1" stopColor="#ffe226" /><stop offset=".79" stopColor="#ff7139" /></radialGradient>
        <radialGradient id={`${id}j`} cx="84%" cy="-41%" r="180%"><stop offset=".11" stopColor="#fff44f" /><stop offset=".46" stopColor="#ff980e" /><stop offset=".72" stopColor="#ff3647" /><stop offset=".9" stopColor="#e31587" /></radialGradient>
        <radialGradient id={`${id}k`} cx="16.1%" cy="-18.6%" r="348.8%" gradientTransform="matrix(.10453 .46743 -.99452 .04913 -.05 -.26)"><stop offset="0" stopColor="#fff44f" /><stop offset=".3" stopColor="#ff980e" /><stop offset=".57" stopColor="#ff3647" /><stop offset=".74" stopColor="#e31587" /></radialGradient>
        <radialGradient id={`${id}l`} cx="18.9%" cy="-42.5%" r="238.4%"><stop offset=".14" stopColor="#fff44f" /><stop offset=".48" stopColor="#ff980e" /><stop offset=".66" stopColor="#ff3647" /><stop offset=".9" stopColor="#e31587" /></radialGradient>
        <radialGradient id={`${id}m`} cx="159.3%" cy="-44.72%" r="313.1%"><stop offset=".09" stopColor="#fff44f" /><stop offset=".63" stopColor="#ff980e" /></radialGradient>
        <linearGradient id={`${id}a`} x1="87.25%" x2="9.4%" y1="15.5%" y2="93.1%"><stop offset=".05" stopColor="#fff44f" /><stop offset=".37" stopColor="#ff980e" /><stop offset=".53" stopColor="#ff3647" /><stop offset=".7" stopColor="#e31587" /></linearGradient>
        <linearGradient id={`${id}n`} x1="80%" x2="18%" y1="14%" y2="84%"><stop offset=".17" stopColor="#fff44f" stopOpacity=".8" /><stop offset=".6" stopColor="#fff44f" stopOpacity="0" /></linearGradient>
        <path id={`${id}c`} d="M47870 16735c-1044-2512-3160-5224-4820-6082 1352 2650 2134 5310 2433 7294 0-6 2 5 4 22l4 26c2268 6147 1032 12398-748 16218-2754 5910-9420 11967-19857 11670-11276-318-21210-8683-23064-19643-338-1728 0-2605 170-4008-207 1080-286 1394-390 3315l-2 123c0 13270 10760 24030 24032 24030 11887 0 21756-8630 23690-19963l110-927c477-4120-53-8453-1560-12075z" />
        <path id={`${id}g`} d="M25677 21050c-40 598-2150 2660-2890 2660-6834 0-7943 4133-7943 4133 303 3480 2726 6348 5660 7865 134 70 270 130 405 193a13277 13277 0 00706 289 10674 10674 0 003127 603c11978 562 14300-14320 5655-18640 2213-385 4510 505 5794 1407-2100-3672-6025-6150-10530-6150-285 0-564 24-844 43a12025 12025 0 00-6614 2549c366 310 780 724 1650 1583 1630 1606 5813 3270 5822 3465z" />
      </defs>
      <path fill={`url(#${id}a)`} d="M47870 16735c-1044-2512-3160-5224-4820-6082 1352 2650 2134 5310 2433 7294l5 40c-2718-6773-7325-9505-11088-15452l-566-920a7372 7372 0 01-265-497 4370 4370 0 01-359-950 63 63 0 00-55-65 82 82 0 00-45 0l-12 7-17 10 10-14c-6037 3536-8085 10076-8274 13350a12025 12025 0 00-6614 2548 7136 7136 0 00-622-470 11134 11134 0 01-68-5873c-2468 1124-4390 2900-5785 4470h-10c-953-1206-886-5187-832-6018-10-52-710 363-802 425a17507 17507 0 00-2349 2012 21048 21048 0 00-2244 2692l-1 3v-3a20284 20284 0 00-3225 7280l-32 160a39700 39700 0 00-237 1500l-5 52a22907 22907 0 00-390 3316l-1 120c0 13270 10760 24030 24032 24030 11887 0 21756-8630 23690-19963l110-927c477-4120-53-8453-1560-12075zM20170 35545c113 53 220 112 334 164l16 10a12620 12620 0 01-350-174zm5506-14493zm19813-3060l-3-23 4 26z" />
      <use fill={`url(#${id}b)`} href={`#${id}c`} />
      <use fill={`url(#${id}d)`} href={`#${id}c`} />
      <path fill={`url(#${id}e)`} d="M36192 19560l150 110a13070 13070 0 00-2231-2911C26640 9290 32150 563 33080 120l10-13c-6037 3535-8085 10076-8273 13348 280-20 560-43 844-43 4505 0 8430 2477 10530 6150z" />
      <use fill={`url(#${id}f)`} href={`#${id}g`} />
      <use fill={`url(#${id}h)`} href={`#${id}g`} />
      <path fill={`url(#${id}i)`} d="M17083 15204a24404 24404 0 01498 330 11134 11134 0 01-67-5874c-2470 1125-4390 2900-5785 4470 115-3 3600-66 5354 1074z" />
      <path fill={`url(#${id}j)`} d="M1822 26240c1855 10960 11788 19325 23063 19644 10437 296 17104-5762 19858-11670 1780-3820 3016-10070 748-16218v-2l-4-24c-2-17-4-28-4-22l5 40c853 5566-1980 10958-6405 14604l-13 30c-8625 7023-16878 4237-18550 3097a14410 14410 0 01-350-174c-5028-2403-7105-6984-6660-10913-4245 0-5693-3580-5693-3580s3812-2718 8836-355c4653 2190 9023 355 9023 354-10-195-4192-1860-5822-3465-872-860-1285-1272-1652-1583a7136 7136 0 00-622-470 28293 28293 0 00-498-330c-1753-1140-5240-1076-5355-1073h-10c-953-1207-886-5188-832-6020-10-50-710 363-802 426a17507 17507 0 00-2349 2012 21048 21048 0 00-2244 2692l-1 3v-3a20284 20284 0 00-3225 7280c-10 52-865 3784-444 5720z" />
      <path fill={`url(#${id}k)`} d="M34110 16760a13070 13070 0 012231 2910l360 296c5450 5020 2594 12120 2380 12626 4426-3646 7258-9038 6405-14604-2716-6774-7323-9506-11086-15453l-566-920a7372 7372 0 01-265-497 4370 4370 0 01-359-950 63 63 0 00-55-65 82 82 0 00-45 0l-12 7-17 10c-930 443-6440 9170 1030 16640z" />
      <path fill={`url(#${id}l)`} d="M36702 19965a4743 4743 0 00-360-295l-150-110c-1283-900-3580-1792-5794-1407 8644 4322 6323 19203-5655 18640a10674 10674 0 01-3127-603 13451 13451 0 01-706-289 9064 9064 0 01-405-193l16 10c1670 1140 9924 3925 18550-3097l13-30c213-506 3068-7606-2380-12626z" />
      <path fill={`url(#${id}m)`} d="M14844 27844s1110-4133 7943-4133c740 0 2850-2062 2890-2660s-4370 1836-9023-354c-5024-2363-8836 354-8836 354s1448 3580 5693 3580c-445 3930 1632 8510 6660 10913 113 53 218 112 334 164-2935-1517-5358-4384-5660-7865z" />
      <path fill={`url(#${id}n)`} d="M47870 16735c-1044-2512-3160-5224-4820-6082 1352 2650 2134 5310 2433 7294l5 40c-2718-6773-7325-9505-11088-15452l-566-920a7372 7372 0 01-265-497 4370 4370 0 01-359-950 63 63 0 00-55-65 82 82 0 00-45 0l-12 7-17 10 10-14c-6037 3536-8085 10076-8274 13350 280-20 560-43 845-43 4505 0 8430 2477 10530 6148-1284-900-3580-1792-5795-1407 8644 4322 6323 19203-5655 18640a10674 10674 0 01-3127-603 13451 13451 0 01-706-289 9064 9064 0 01-405-193l17 10a14410 14410 0 01-350-174c112 53 218 112 333 164-2935-1517-5358-4384-5660-7865 0 0 1108-4133 7942-4133 740 0 2850-2062 2890-2660-10-195-4190-1860-5822-3465-870-860-1285-1272-1650-1583a7136 7136 0 00-623-470 11134 11134 0 01-67-5873c-2470 1124-4390 2900-5785 4470h-10c-953-1207-886-5187-832-6020-10-50-710 363-802 426a17507 17507 0 00-2349 2012 21048 21048 0 00-2243 2692l-1 3v-3a20284 20284 0 00-3225 7280l-32 160a39787 39787 0 00-277 1515c-2 18 2-17 0 0a27956 27956 0 00-355 3353l-3 122c0 13270 10760 24030 24032 24030 11887 0 21756-8630 23690-19963l110-927c477-4120-53-8453-1560-12075zm-2384 1234l4 26v-2l-4-24z" />
    </svg>
  );
}

export function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8ZM14.1 5.9c.6-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3Z" />
    </svg>
  );
}

export function AndroidMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#3DDC84" d="M3 17a9 9 0 0 1 18 0Z" />
      <path d="m6.3 9.6-1.8-3M17.7 9.6l1.8-3" stroke="#3DDC84" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8.4" cy="13.6" r="1.1" fill="#fff" /><circle cx="15.6" cy="13.6" r="1.1" fill="#fff" />
    </svg>
  );
}

/** Where to get each eGuard client. `null` means not published yet. */
export const STORE_LINKS = {
  googlePlay: "https://play.google.com/store/apps/details?id=com.devcom.eguard",
  appStore: null,
  chrome: "https://chromewebstore.google.com/detail/eguard-browser-protection/mbmebjjdmbnadjghjgakafhgmbhimadk",
  edge: "https://microsoftedge.microsoft.com/addons/detail/eguard-browser-protection/noapokcbieljofcaajebjdmddbjpeckd",
  firefox: "https://addons.mozilla.org/en-US/firefox/addon/eguard-browser-protection/",
} as const;
