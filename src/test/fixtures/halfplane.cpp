#include <algorithm>
#include <cassert>
#include <type_traits>

template <class T>
struct Point {
  T x{};
  T y{};

  Point() = default;
  Point(T x, T y) : x(x), y(y) {}

  Point operator+(const Point &other) const {
    return Point(x + other.x, y + other.y);
  }
};

template <class T>
struct Line {
  Point<T> a;
  Point<T> b;

  Line() = default;
  Line(Point<T> a, Point<T> b) : a(a), b(b) {}
};

template <class T>
struct Halfplane : Line<T> {
  using Line<T>::Line;

  Halfplane() = default;

  template <class U = T, std::enable_if_t<!std::is_integral_v<U>, int> = 0>
  Halfplane(T A, T B, T C) {
    assert(A != T(0) || B != T(0));
    if (A == T(0) && B == T(0)) return;
    T aa = A < T(0) ? -A : A;
    T ab = B < T(0) ? -B : B;
    T s = std::max(aa, ab);
    if (aa >= ab) {
      this->a = Point<T>(-C / A, T(0));
    } else {
      this->a = Point<T>(T(0), -C / B);
    }
    this->b = this->a + Point<T>(B / s, -A / s);
  }
};

int main() {
  Halfplane<long double> halfplane{1.0L, 2.0L, 3.0L};
  return halfplane.a.x == 0.0L;
}
