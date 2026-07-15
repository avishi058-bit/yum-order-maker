const KitchenInstall = () => {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6" dir="rtl">
      <section className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-primary text-primary-foreground text-4xl">
          🍔
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">התקנת מטבח הבקתה</h1>
          <p className="text-muted-foreground font-semibold leading-8">
            פתח את הקישור הזה בדפדפן, ואז הוסף למסך הבית. האייקון החדש יפתח ישר את מסך המטבח.
          </p>
        </div>
        <ol className="text-right space-y-3 rounded-lg border border-border bg-card p-5 font-bold leading-7">
          <li>1. לחץ על שיתוף / שלוש נקודות בדפדפן</li>
          <li>2. בחר “הוסף למסך הבית”</li>
          <li>3. פתח את האייקון החדש בשם “מטבח”</li>
        </ol>
        <a
          href="/kitchen"
          className="inline-flex min-h-14 w-full items-center justify-center rounded-lg bg-primary px-5 text-lg font-black text-primary-foreground"
        >
          כניסה למטבח
        </a>
        <p className="text-sm text-muted-foreground">אם כבר התקנת אייקון קודם — מחק אותו והתקן מחדש מהקישור הזה.</p>
      </section>
    </main>
  );
};

export default KitchenInstall;