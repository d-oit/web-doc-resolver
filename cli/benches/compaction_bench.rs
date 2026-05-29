use criterion::{Criterion, criterion_group, criterion_main};
use do_wdr_lib::compaction::compact_content;
use std::time::Duration;

fn bench_compaction(c: &mut Criterion) {
    let input = r#"
# Sample Page

This is a sample page with some content.
It has multiple lines.

Cookie Policy: We use cookies.
All rights reserved (c) 2026.
Privacy Policy is available here.

```rust
fn main() {
    println!("Hello, world!");
}
```

Subscribe to our newsletter for more updates.
Follow us on Twitter.
Click here to learn more.

---

### Technical Details

| Feature | Status |
|---------|--------|
| Speed   | Fast   |
| Quality | High   |

$$
E = mc^2
$$

{\displaystyle \int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}}

\begin{aligned}
a &= b + c \\
d &= e + f
\end{aligned}

<pre>
Some preformatted text.
</pre>

<code>
inline code
</code>

...
...
!!!
    "#
    .repeat(50); // Make it large enough to measure

    let mut group = c.benchmark_group("compaction");
    group.measurement_time(Duration::from_secs(5));

    group.bench_function("compact_content", |b| {
        b.iter(|| {
            compact_content(&input, 10000);
        });
    });

    group.finish();
}

criterion_group!(benches, bench_compaction);
criterion_main!(benches);
