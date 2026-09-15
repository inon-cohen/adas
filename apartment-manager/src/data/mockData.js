export const apartments = [
  { 
    id: 1, 
    name: "דירה 1 - מרכז העיר", 
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    lastChecked: "2026-02-20",
    hasCriticalIssue: false,
    history: [
      { id: 10, date: "2026-02-20", inspector: "עינון", summary: "בדיקה תקינה - מוכן לאורחים", tasks: [
        { task: "בדיקת ניקיון כללי", status: "תקין", notes: "מבריק" },
        { task: "בדיקת תקינות מזגנים", status: "תקין", notes: "" },
        { task: "מלאי מגבות וסבונים", status: "תקין", notes: "" }
      ]}
    ]
  },
  { 
    id: 2, 
    name: "דירה 2 - קו ראשון לים", 
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    lastChecked: "2026-02-28",
    hasCriticalIssue: true,
    history: [
      { id: 20, date: "2026-02-28", inspector: "עינון", summary: "נמצאו ליקויים - נזילה במקלחת", tasks: [
        { task: "בדיקת רטיבות / נזילות", status: "דורש טיפול", notes: "יש טפטוף מתחת לכיור" },
        { task: "בדיקת תקינות מזגנים", status: "תקין", notes: "" }
      ]}
    ]
  }
];

export const checklists = {
  1: [
    { id: 101, task: "בדיקת WIFI בווילה", status: "", notes: "", image: "" },
    { id: 102, task: "בדיקת תקינות מזגנים (חימום וקירור)", status: "", notes: "", image: "" }
  ],
  2: [
    { id: 201, task: "בדיקת נזילות או רטיבות במקלחת", status: "", notes: "", image: "" },
    { id: 202, task: "בדיקת מלאי קפסולות קפה", status: "", notes: "", image: "" }
  ]
};