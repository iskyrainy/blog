---
title: Read Code-ArrayList
category: Tech
tag: [Java, ReadCode]
date: 2025-04-27T09:52:41+08:00
---

# ReadCode-ArrayList

## `ArrayList`는 `RandomAccess` 인터페이스를 구현하여 임의 접근을 지원한다

RandomAccess는 Java에서 빠른 임의 접근을 지원하는 컬렉션을 나타내는 마커 인터페이스이다. 컬렉션이 RandomAccess 인터페이스를 구현하면 인덱스를 통해 컬렉션의 요소에 직접 접근할 수 있으며, 순회가 필요하지 않다. 반대로 컬렉션이 RandomAccess 인터페이스를 구현하지 않으면 반복자를 통해서만 컬렉션의 요소를 순회할 수 있다.

Java에서 ArrayList는 배열 기반 컬렉션이므로 인덱스를 통해 요소에 직접 접근할 수 있기 때문에 RandomAccess 인터페이스를 구현한다. 반면 LinkedList는 연결 리스트 기반 컬렉션이므로 반복자를 통해서만 요소를 순회할 수 있기 때문에 RandomAccess 인터페이스를 구현하지 않는다.

RandomAccess 인터페이스 자체는 어떤 메서드도 정의하지 않으며, 단지 컬렉션이 빠른 임의 접근을 지원하는지를 표시하는 데 사용된다. 컬렉션이 RandomAccess 인터페이스를 구현하면 Collections 유틸리티 클래스가 제공하는 binarySearch 메서드를 통해 이진 검색을 수행하여 요소를 더 빠르게 찾을 수 있다.

```JAVA
public class ArrayList<E> extends AbstractList<E>
        implements List<E>, RandomAccess, Cloneable, java.io.Serializable
```



## `modCount` 상세 설명

Java 컬렉션에서 modCount는 컬렉션의 구조적 수정 횟수를 기록하는 카운터이다. 컬렉션 구조가 변경될 때, 예를 들어 요소를 추가하거나 삭제할 때 modCount 카운터가 증가한다. 예를 들어 ArrayList, HashMap, HashSet 등의 컬렉션 클래스에는 모두 modCount 카운터가 있다.

modCount는 컬렉션의 fail-fast 메커니즘을 지원하는 데 사용된다. 컬렉션을 순회하는 동안 modCount 값이 이미 변경된 것이 감지되면 ConcurrentModificationException 예외가 발생한다. 이는 동시 수정 시 데이터의 불일치와 안전 문제를 방지하기 위한 것이다.

modCount 속성은 일반적으로 fail-fast 메커니즘을 구현하는 데 사용되며, 멀티스레드 환경에서 컬렉션이 순회되고 있는 동안 해당 컬렉션이 수정되면 modCount 값을 확인하여 ConcurrentModificationException 예외를 발생시켜 프로그램의 안전성을 보장할 수 있다.

다음은 멀티스레드 환경에서 modCount를 사용하여 fail-fast 메커니즘을 구현하는 방법을 보여주는 예제이다:

```java
public class MyList<E> extends AbstractList<E> {
    private ArrayList<E> internalList = new ArrayList<>();
    private int modCount = 0;

    public void add(int index, E element) {
        modCount++;
        internalList.add(index, element);
    }

    public E remove(int index) {
        modCount++;
        return internalList.remove(index);
    }

    public E get(int index) {
        return internalList.get(index);
    }

    public int size() {
        return internalList.size();
    }

    public Iterator<E> iterator() {
        return new Iterator<E>() {
            private int expectedModCount = modCount;
            private int currentIndex = 0;

            public boolean hasNext() {
                return currentIndex < size();
            }

            public E next() {
                checkForModification();
                if (!hasNext()) {
                    throw new NoSuchElementException();
                }
                return internalList.get(currentIndex++);
            }

            private void checkForModification() {
                if (modCount != expectedModCount) {
                    throw new ConcurrentModificationException();
                }
            }
        };
    }
}

```

MyList 클래스는 AbstractList 클래스를 상속하고 add, remove, get, size 메서드를 구현한다. add와 remove 메서드에서 modCount 속성이 증가한다. iterator 메서드에서는 매번 순회 전에 modCount와 expectedModCount가 같은지 확인하고, 같지 않으면 ConcurrentModificationException 예외를 발생시킨다.

주의할 점은 modCount는 동시 수정 예외의 일부만 포착할 수 있다는 것이다. 예를 들어 어떤 스레드가 하나의 요소를 삭제하고 다른 스레드가 동시에 다른 요소를 수정하면 예외가 발생하지 않는다. 따라서 동시 환경에서는 데이터의 일관성과 스레드 안전성을 보장하기 위해 전용 동시성 컬렉션 클래스를 사용해야 한다.



## `ArrayList`의 기본 크기는 10이다.

```java
private static final int DEFAULT_CAPACITY = 10;
```

초기화를 통해 `capacity` 크기를 자유롭게 정의할 수 있다:

```java
    // init with a size selected by coder.
	public ArrayList(int initialCapacity) {
        if (initialCapacity > 0) {
            this.elementData = new Object[initialCapacity];
        } else if (initialCapacity == 0) {
            this.elementData = EMPTY_ELEMENTDATA;
        } else {
            throw new IllegalArgumentException("Illegal Capacity: "+
                                               initialCapacity);
        }
    }

	// empty list and capacity is 10.
    public ArrayList() {
        this.elementData = DEFAULTCAPACITY_EMPTY_ELEMENTDATA;
    }

	// if c is ArrayList then make a list containing the elements of the c.
    public ArrayList(Collection<? extends E> c) {
        Object[] a = c.toArray();
        if ((size = a.length) != 0) {
            if (c.getClass() == ArrayList.class) {
                elementData = a;
            } else {
                elementData = Arrays.copyOf(a, size, Object[].class);
            }
        } else {
            // replace with empty array.
            elementData = EMPTY_ELEMENTDATA;
        }
    }
```



## `trimToSize` 상세 설명

먼저 삼항 연산자를 사용하여 현재 ArrayList에 요소가 존재하는지 판단한다. 현재 size가 0이면 `elementData`를 `EMPTY_ELEMENTDATA`, 즉 길이가 0인 빈 배열을 가리키게 한다. 그렇지 않으면 `Arrays.copyOf()` 메서드를 사용하여 `elementData` 배열의 요소를 새 배열에 복사하고, 새 배열의 길이를 size로 설정한다. 최종적으로 `elementData`는 새 배열을 가리킨다.

이 작업의 주된 목적은 ArrayList 객체가 차지하는 메모리 공간을 줄이는 것이다. ArrayList는 실제 사용 과정에서 요소의 수와 차지하는 메모리 공간이 지속적으로 변할 수 있기 때문에 상당한 공간 낭비가 존재할 수 있다. `trimToSize()` 메서드를 호출하면 이러한 유휴 메모리 공간을 해제하여 프로그램의 메모리 사용 효율을 높일 수 있다.

```java
    public void trimToSize() {
        modCount++;
        if (size < elementData.length) {
            elementData = (size == 0)
              ? EMPTY_ELEMENTDATA
              : Arrays.copyOf(elementData, size);
        }
    }
```



## `grow` 상세 설명

원본 `list`가 비어 있지 않으면 `newLength()` 메서드를 사용하여 새 `list`의 크기를 계산한다.

```java
    private Object[] grow(int minCapacity) {
        int oldCapacity = elementData.length;
        if (oldCapacity > 0 || elementData != DEFAULTCAPACITY_EMPTY_ELEMENTDATA) {
            /** 
             * newLength will return the number after count.
             * oldCapacity is the size of list now.
             * minCapacity - oldCapacity is the size will enlarge.
             * oldCapacity >> 1 is the size will be enlarged at least.
            **/
            int newCapacity = ArraysSupport.newLength(oldCapacity,
                    minCapacity - oldCapacity, /* minimum growth */
                    oldCapacity >> 1           /* preferred growth */);
            return elementData = Arrays.copyOf(elementData, newCapacity);
        } else {
            return elementData = new Object[Math.max(DEFAULT_CAPACITY, minCapacity)];
        }
    }

    private Object[] grow() {
        return grow(size + 1);
    }

	// if list is not null, count the new list's size.
    public static int newLength(int oldLength, int minGrowth, int prefGrowth) {
        // preconditions not checked because of inlining
        // assert oldLength >= 0
        // assert minGrowth > 0

        int prefLength = oldLength + Math.max(minGrowth, prefGrowth); // might overflow
        if (0 < prefLength && prefLength <= SOFT_MAX_ARRAY_LENGTH) {
            return prefLength;
        } else {
            // put code cold in a separate method
            return hugeLength(oldLength, minGrowth);
        }
    }

    private static int hugeLength(int oldLength, int minGrowth) {
        int minLength = oldLength + minGrowth;
        if (minLength < 0) { // overflow
            throw new OutOfMemoryError(
                "Required array length " + oldLength + " + " + minGrowth + " is too large");
        } else if (minLength <= SOFT_MAX_ARRAY_LENGTH) {
            return SOFT_MAX_ARRAY_LENGTH;
        } else {
            return minLength;
        }
    }

```



## `contains()/lastIndexOf()` 상세 설명

`o == null`이면 `elementData`를 순회하여 `null`이 존재하면 해당 `index`를 반환한다. `o != null`이면 `elementData`가 `o`를 포함하는지 순회하여 해당 `index`를 반환한다. 나머지 경우에는 `-1`을 반환한다.

마찬가지로 `lastindexof()`의 원리도 유사하다. `o == null`이면 뒤에서 앞으로 `elementData`를 순회하여 `null`이 존재하면 해당 `index`를 반환한다. `o != null`이면 뒤에서 앞으로 `elementData`를 순회하여 `o.equals(elementData[i])`가 존재하면 해당 `index`를 반환한다. 나머지는 `-1`을 반환한다. 소스 코드는 생략하며 `contains()`와 유사하다.

```java
    // judge 'o' is or not this list's data.
    public boolean contains(Object o) {
        return indexOf(o) >= 0;
    }
	
    public int indexOf(Object o) {
        return indexOfRange(o, 0, size);
    }

    int indexOfRange(Object o, int start, int end) {
        Object[] es = elementData;
        if (o == null) {
            for (int i = start; i < end; i++) {
                if (es[i] == null) {
                    return i;
                }
            }
        } else {
            for (int i = start; i < end; i++) {
                if (o.equals(es[i])) {
                    return i;
                }
            }
        }
        return -1;
    }
```



## `clone()` 상세 설명

```java
    // this method will returns a shallow copy of this arraylist instance, rather than referencece those object by itself.
	// For example, consider an object 'person' that contains a reference to another object 'address'. If a shallow copy is made of 'person', the new object will contain a reference to the same 'address' object as the original 'person' object, rather than creating a new copy of the 'address' object.
	public Object clone() {
        try {
            ArrayList<?> v = (ArrayList<?>) super.clone();
            v.elementData = Arrays.copyOf(elementData, size);
            v.modCount = 0;
            return v;
        } catch (CloneNotSupportedException e) {
            // this shouldn't happen, since we are Cloneable
            throw new InternalError(e);
        }
    }
```



## `toArray()` 상세 설명

매개변수 a를 받으며, 이는 요소를 변환할 대상 배열을 나타낸다. a의 길이가 `ArrayList`의 `size`보다 작으면 동일한 타입의 새 배열을 생성하고 `ArrayList`의 요소를 해당 배열에 복사한다.

a의 길이가 `ArrayList`의 `size`보다 크거나 같으면 `ArrayList`의 요소가 a에 직접 복사된다. a의 길이가 `ArrayList`의 `size`보다 크면 a의 `size`번째 요소가 `null`로 설정된다.

이 메서드는 변환된 배열을 반환한다. 주의할 점은 대상 배열의 타입이 `ArrayList`의 요소 타입의 하위 타입이 아니면 `toArray` 메서드가 새 배열을 반환한다는 것이다. 이를 방지하려면 제네릭을 사용하여 대상 배열의 타입을 `toArray` 메서드의 매개변수로 전달할 수 있다.

```java
    @SuppressWarnings("unchecked")
    public <T> T[] toArray(T[] a) {
        if (a.length < size)
            // Make a new array of a's runtime type, but my contents:
            return (T[]) Arrays.copyOf(elementData, size, a.getClass());
        System.arraycopy(elementData, 0, a, 0, size);
        if (a.length > size)
            a[size] = null;
        return a;
    }
```



## `set()` 상세 설명

`index`가 유효한지 확인하고, 이전 `index` 위치의 `element`를 반환하며, `modCount` 값을 변경하지 않는다.

```java
    public E set(int index, E element) {
        rangeCheck(index);

        E oldValue = elementData(index);
        elementData[index] = element;
        return oldValue;
    }
```



## `remove()` 상세 설명

`arraycopy()`를 사용하여 `index` 이후의 요소를 앞으로 복사하여 이동하며, 시간 복잡도는 `O(N)`이다.

```java
    public E remove(int index) {
        rangeCheck(index);

        modCount++;
        E oldValue = elementData(index);

        int numMoved = size - index - 1;
        if (numMoved > 0)
            System.arraycopy(elementData, index+1, elementData, index,
                             numMoved);
        elementData[--size] = null; // clear to let GC do its work

        return oldValue;
    }
```

이해하기 쉽다.

```java
    public boolean remove(Object o) {
        final Object[] es = elementData;
        final int size = this.size;
        int i = 0;
        found: {
            if (o == null) {
                for (; i < size; i++)
                    if (es[i] == null)
                        break found;
            } else {
                for (; i < size; i++)
                    if (o.equals(es[i]))
                        break found;
            }
            return false;
        }
        fastRemove(es, i);
        return true;
    }

	/**
     * Private remove method that skips bounds checking and does not
     * return the value removed.
     */
    private void fastRemove(Object[] es, int i) {
        modCount++;
        final int newSize;
        if ((newSize = size - 1) > i)
            System.arraycopy(es, i + 1, es, i, newSize - i);
        es[size = newSize] = null;
    }
```



## `equals()` 상세 설명

object `o`가 `this`가 가리키는 객체와 같으면 바로 `true`를 반환한다.

`o`가 `List` 및 그 하위 클래스의 인스턴스가 아니면 `false`를 반환한다.

`o`가 `ArrayList`의 인스턴스이면 `equalsArrayList()`를 호출하고, 그렇지 않으면 `equalsRange()`를 호출한다.

`modCount`를 확인하여 `modCount != expectedModCount`이면 `ConcurrentModificationException` 예외를 발생시킨다.

```java
    public boolean equals(Object o) {
        if (o == this) {
            return true;
        }

        if (!(o instanceof List)) {
            return false;
        }

        final int expectedModCount = modCount;
        // ArrayList can be subclassed and given arbitrary behavior, but we can
        // still deal with the common case where o is ArrayList precisely
        boolean equal = (o.getClass() == ArrayList.class)
            ? equalsArrayList((ArrayList<?>) o)
            : equalsRange((List<?>) o, 0, size);

        checkForComodification(expectedModCount);
        return equal;
    }

    boolean equalsRange(List<?> other, int from, int to) {
        final Object[] es = elementData;
        // if to > es.length, overborder.
        if (to > es.length) {
            throw new ConcurrentModificationException();
        }
        var oit = other.iterator();
        for (; from < to; from++) {
            // if 'other' has not next element, return false;
            // if other's element is not equals with this object's element, return false.
            if (!oit.hasNext() || !Objects.equals(es[from], oit.next())) {
                return false;
            }
        }
        // if 'other' still has next element, return false;
        // if 'other' has not any element, return true.
        return !oit.hasNext();
    }

    private boolean equalsArrayList(ArrayList<?> other) {
        // keep other.modCount, if 'other' be changed by other threads, throw exception.
        final int otherModCount = other.modCount;
        final int s = size;
        boolean equal;
        if (equal = (s == other.size)) {
            final Object[] otherEs = other.elementData;
            final Object[] es = elementData;
            // overborder
            if (s > es.length || s > otherEs.length) {
                throw new ConcurrentModificationException();
            }
            for (int i = 0; i < s; i++) {
                if (!Objects.equals(es[i], otherEs[i])) {
                    equal = false;
                    break;
                }
            }
        }
        other.checkForComodification(otherModCount);
        return equal;
    }

    private void checkForComodification(final int expectedModCount) {
        if (modCount != expectedModCount) {
            throw new ConcurrentModificationException();
        }
    }
```



## `hashCode()` 상세 설명

```java
    public int hashCode() {
        int expectedModCount = modCount;
        int hash = hashCodeRange(0, size);
        checkForComodification(expectedModCount);
        return hash;
    }

    int hashCodeRange(int from, int to) {
        final Object[] es = elementData;
        // overborder
        if (to > es.length) {
            throw new ConcurrentModificationException();
        }
        int hashCode = 1;
        // compute hashCode
        for (int i = from; i < to; i++) {
            Object e = es[i];
            hashCode = 31 * hashCode + (e == null ? 0 : e.hashCode());
        }
        return hashCode;
    }
```



## `addAll()` 상세 설명

`a = c.toArray()`가 비어 있으면 `false`를 반환한다. `a`가 비어 있지 않고 `a.length > (elementData.length - size)`이면 `grow()`를 호출하여 `elementData`를 확장한 다음 `arraycopy()`를 사용하여 `a`를 `elementData`에 복사한다.

```java
    public boolean addAll(Collection<? extends E> c) {
        Object[] a = c.toArray();
        modCount++;
        int numNew = a.length;
        if (numNew == 0)
            return false;
        Object[] elementData;
        final int s;
        if (numNew > (elementData = this.elementData).length - (s = size))
            elementData = grow(s + numNew);
        System.arraycopy(a, 0, elementData, s, numNew);
        size = s + numNew;
        return true;
    }
```



## `batchRemove()` 상세 설명

이 메서드는 `Collection` 타입의 매개변수 `c`, boolean 타입의 매개변수 `complement`, int 타입의 매개변수 `from`과 int 타입의 매개변수 `end`를 받는다. 여기서 `c`는 삭제할 요소의 컬렉션을 나타내고, `complement`가 true이면 c에 존재하지 않는 요소를 삭제하고, 그렇지 않으면 c에 존재하는 요소를 삭제한다. from과 end는 삭제할 요소의 시작 위치와 끝 위치를 나타내며, from을 포함하지만 end는 포함하지 않는다.

먼저 이 메서드는 complement 값에 따라 r의 초기값을 결정한다. r이 가리키는 요소를 삭제할 필요가 없으면 r을 계속 오른쪽으로 이동하여 삭제해야 할 요소를 찾는다. 이때 r은 첫 번째로 삭제해야 할 요소를 가리키고, w는 다음 요소의 위치를 가리킨다.

그런 다음 r부터 시작하는 후속 요소 중에서 삭제할 필요가 없는 요소를 찾아 w가 있는 위치로 이동하고, 동시에 w를 오른쪽으로 한 위치 이동한다. 지정된 범위의 모든 요소를 순회한 후, w가 가리키는 위치는 다음으로 삭제할 필요가 없는 요소의 위치, 즉 w와 그 오른쪽의 요소를 삭제해야 한다.

마지막으로 요소 배열에서 w부터 end까지의 요소를 왼쪽으로 w - end만큼 이동하고, 동시에 modCount를 업데이트하여 ArrayList에 대한 수정 횟수를 나타낸다.

`example:`

숫자를 저장하는 ArrayList가 다음과 같다고 가정하자:

```java
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

여기서 모든 짝수 요소(즉, 2, 4, 6, 8, 10)를 삭제하려고 한다. 짝수를 저장하는 HashSet을 생성한 다음 이를 batchRemove 메서드의 매개변수로 전달할 수 있다. 구체적인 코드는 다음과 같다:

```java
ArrayList<Integer> list = new ArrayList<>(Arrays.asList(1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
HashSet<Integer> set = new HashSet<>(Arrays.asList(2, 4, 6, 8, 10));
list.batchRemove(set, false, 0, list.size());
```

여기서 첫 번째 매개변수는 짝수를 저장하는 HashSet이고, 두 번째 매개변수는 false로 HashSet에 있는 모든 요소를 삭제함을 나타내며, 세 번째 매개변수는 0으로 리스트의 처음부터 스캔함을 나타내고, 네 번째 매개변수는 리스트의 크기로 리스트의 끝까지 스캔함을 나타낸다.

batchRemove 메서드 내부에서는 먼저 루프를 통해 첫 번째로 삭제해야 할 요소의 위치를 찾은 다음, 이 위치부터 삭제할 필요가 없는 요소를 앞으로 이동하고, 마지막으로 남은 요소를 삭제한다. 구체적인 과정은 다음과 같다:

1. 위치 0부터 스캔하여 요소 1을 찾고, 삭제할 필요가 없으므로 계속 스캔한다.
2. 위치 1부터 스캔하여 요소 2를 찾고, 삭제해야 하므로 루프를 빠져나온다.
3. 위치 1을 r로 기록하고, 위치 2부터 삭제할 필요가 없는 요소 1을 앞으로 한 위치 이동하여 위치 1의 요소 2를 덮어쓴다.

```java
[1, 3, 4, 5, 6, 7, 8, 9, 10, 10]
   r
   w
```

4. 위치 2부터 스캔하여 요소 3을 찾고, 삭제할 필요가 없으므로 위치 w(1)로 이동하고, w를 1 증가시킨다.

```java
[1, 3, 4, 5, 6, 7, 8, 9, 10, 10]
   r
      w
```

5. 위치 3부터 스캔하여 요소 4를 찾고, 삭제해야 하므로 건너뛴다.

6. 위치 4부터 스캔하여 요소 5를 찾고, 삭제할 필요가 없으므로 위치 w(2)로 이동하고, w를 1 증가시킨다.

```java
[1, 3, 5, 5, 6, 7, 8, 9, 10, 10]
   r
         w
```

7. 위치 5부터 스캔하여 요소 6을 찾고, 삭제해야 하므로 건너뛴다.

8. 위치 6부터 스캔하여 요소 7을 찾고, 삭제할 필요가 없으므로 위치 w(3)로 이동하고, w를 1 증가시킨다.

```java
[1, 3, 5, 7, 6, 7, 8, 9, 10, 10]
   r
            w
```

`try` 블록이 끝날 때까지 계속한다.

......

```java
    boolean batchRemove(Collection<?> c, boolean complement,
                        final int from, final int end) {
        Objects.requireNonNull(c);
        final Object[] es = elementData;
        int r;
        // Optimize for initial run of survivors
        for (r = from;; r++) {
            // not include the element of index 'end'
            if (r == end)
                return false;
            if (c.contains(es[r]) != complement)
                break;
        }
        int w = r++;
        try {
            for (Object e; r < end; r++)
                if (c.contains(e = es[r]) == complement)
                    es[w++] = e;
        } catch (Throwable ex) {
            // Preserve behavioral compatibility with AbstractCollection,
            // even if c.contains() throws.
            System.arraycopy(es, r, es, w, end - r);
            w += end - r;
            throw ex;
        } finally {
            modCount += end - w;
            shiftTailOverGap(es, w, end);
        }
        return true;
    }
```



## `shiftTailOverGap()` 상세 설명

`shiftTailOverGap(Object[] es, int lo, int hi)`는 `lo`부터 `hi`까지의 요소를 삭제하는 데 사용된다.

```java
    private void shiftTailOverGap(Object[] es, int lo, int hi) {
        // put elements, which are from hi to size-1, to the 'lo'. array will change from [1, 2, 3, ... , lo, ... , hi, ... size-1] to [1, 2, 3, ... , lo-1, hi, ... , size-1].
        System.arraycopy(es, hi, es, lo, size - hi);
        // tag useless pos as null, let GC take it over.
        for (int to = size, i = (size -= hi - lo); i < to; i++)
            es[i] = null;
    }
```



## `writeObject()/readObject()` 상세 설명

### 직렬화와 역직렬화

직렬화와 역직렬화는 객체를 바이트 스트림으로 변환하여 전송하고, 바이트 스트림을 다시 객체로 복원하는 과정을 말한다.

직렬화는 Java 객체를 바이트 스트림으로 변환하여 디스크에 저장하거나 네트워크를 통해 다른 곳으로 전송할 수 있게 하는 것이다. 직렬화는 데이터 영속화, 원격 통신 등의 시나리오에 사용될 수 있다. Java에서 직렬화를 구현하려면 Serializable 인터페이스를 구현하면 된다.

역직렬화는 바이트 스트림을 다시 객체로 복원하여 이 객체를 사용할 수 있게 하는 과정이다. Java에서 역직렬화는 ObjectInputStream 클래스를 통해 구현할 수 있다. 역직렬화할 때 바이트 스트림과 클래스 로더의 정확성을 보장해야 하며, 그렇지 않으면 ClassNotFoundException 등의 예외가 발생할 수 있다.

주의할 점은 직렬화와 역직렬화를 수행할 때 객체 그래프 문제가 관련될 수 있다는 것이다. 객체가 다른 객체의 참조를 포함하고 있으면 직렬화와 역직렬화 시 전체 객체 그래프가 올바르게 직렬화되고 역직렬화될 수 있도록 보장해야 하며, 그렇지 않으면 데이터 불일치 등의 문제가 발생할 수 있다. 따라서 직렬화와 역직렬화를 수행할 때 전체 객체 그래프를 고려해야 한다.

| 장점                                                         | 단점                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| 객체를 이진 스트림 형태로 영속화하여 객체의 원격 전송을 구현할 수 있다 | 직렬화된 객체는 상대적으로 무거워 공간을 많이 차지한다       |
| 서로 다른 플랫폼, 서로 다른 언어 간에 데이터를 전송하여 크로스 언어 통신을 구현할 수 있다 | 객체의 직렬화와 역직렬화 작업은 시간과 성능을 소모한다       |
| 캐시, 로그 기록 등 객체의 저장과 읽기가 편리하다             | 직렬화된 객체는 전송 과정에서 중간자 공격을 받기 쉬우므로 암호화와 인증이 필요하다 |
| 깊은 복사를 구현할 수 있다. 즉, 객체를 완전히 복사하여 원본 객체의 상태에 영향을 주지 않는다 | 객체의 속성 변경이 크면 역직렬화 시 클래스 버전 불일치 문제가 발생할 수 있으므로 버전 호환성 처리가 필요하다 |
| 객체의 상태가 저장되어 필요할 때 역직렬화하여 객체의 상태를 복원할 수 있다 | 직렬화 시 민감한 정보를 저장하면 역직렬화 시 데이터 프라이버시가 유출되기 쉽다 |
| 직렬화와 역직렬화가 객체의 자기 서술을 구현하여 메타 정보 처리가 편리하다 | 직렬화된 객체를 압축 및 해제해야 하면 성능과 공간 점유 문제가 발생할 수 있다 |

### 메서드 설명

ArrayList의 `writeObject` 메서드는 ArrayList 인스턴스를 바이트 스트림으로 직렬화하는 데 사용된다. 메모리와 디스크 간의 객체 전송, 네트워크를 통한 객체 전송 등에 사용된다.

Java에서 객체를 직렬화하려면 `Serializable` 인터페이스를 구현해야 한다. 직렬화할 때 Java는 객체를 바이트 시퀀스로 변환하고, 역직렬화할 때 Java는 바이트 시퀀스를 원래 객체로 복원한다. ArrayList는 Serializable 인터페이스를 구현하므로 직렬화할 수 있다.

ArrayList에서 ArrayList 인스턴스를 직렬화해야 할 때 writeObject 메서드는 ArrayList 인스턴스의 요소를 하나씩 ObjectOutputStream에 기록한다. 직렬화 과정에서 ArrayList의 "용량"은 직렬화되지 않고 ArrayList의 요소만 직렬화된다. 또한 ArrayList는 역직렬화할 때 `readObject` 메서드를 사용하여 ObjectInputStream에서 요소를 읽고 ArrayList 객체를 재구성한다.

주의할 점은 ArrayList의 요소도 직렬화 가능한 객체여야 한다는 것이다. 요소가 직렬화 불가능한 객체이면 직렬화 과정에서 NotSerializableException 예외가 발생한다.

```java
    @java.io.Serial
    private void writeObject(java.io.ObjectOutputStream s)
        throws java.io.IOException {
        // Write out element count, and any hidden stuff
        int expectedModCount = modCount;
        s.defaultWriteObject();

        // Write out size as capacity for behavioral compatibility with clone()
        s.writeInt(size);

        // Write out all elements in the proper order.
        for (int i=0; i<size; i++) {
            s.writeObject(elementData[i]);
        }

        if (modCount != expectedModCount) {
            throw new ConcurrentModificationException();
        }
    }

    @java.io.Serial
    private void readObject(java.io.ObjectInputStream s)
        throws java.io.IOException, ClassNotFoundException {

        // Read in size, and any hidden stuff
        s.defaultReadObject();

        // Read in capacity
        s.readInt(); // ignored

        if (size > 0) {
            // like clone(), allocate array based upon size not capacity
            SharedSecrets.getJavaObjectInputStreamAccess().checkArray(s, Object[].class, size);
            Object[] elements = new Object[size];

            // Read in all elements in the proper order.
            for (int i = 0; i < size; i++) {
                elements[i] = s.readObject();
            }

            elementData = elements;
        } else if (size == 0) {
            elementData = EMPTY_ELEMENTDATA;
        } else {
            throw new java.io.InvalidObjectException("Invalid size: " + size);
        }
    }
```



## `Consumer.class`

Java에서 `Consumer`는 함수형 인터페이스로, 추상 메서드 `void accept(T t)`를 포함하며, 이 메서드는 하나의 매개변수를 받고 결과를 반환하지 않는다. `Consumer` 인터페이스는 일반적으로 객체에 대한 작업, 예를 들어 객체의 상태를 수정하거나 출력하는 데 사용된다. 다음은 `Consumer`를 사용하여 정수 리스트의 각 요소를 출력하는 간단한 예제이다:

```java
import java.util.Arrays;
import java.util.List;
import java.util.function.Consumer;

public class Example {
    public static void main(String[] args) {
        List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5);
        Consumer<Integer> printer = n -> System.out.println(n);
        numbers.forEach(printer);
    }
}

```

위 예제에서는 정수 리스트를 생성하고, 각 요소를 출력하는 `Consumer` 객체 `printer`를 정의했다. 그런 다음 `forEach` 메서드를 사용하여 리스트를 순회하고, 각 요소에 대해 `accept` 메서드를 실행하여 해당 요소를 `printer` 객체에 전달한다.

`Consumer` 인터페이스에는 여러 `Consumer`를 조합하는 데 사용할 수 있는 몇 가지 기본 메서드도 있다. 예를 들어 `andThen` 메서드는 두 개의 `Consumer`를 하나로 조합하고 순서대로 `accept` 메서드를 실행한다. 예를 들어:

```java
import java.util.function.Consumer;

public class Example {
    public static void main(String[] args) {
        Consumer<String> first = s -> System.out.println("First: " + s);
        Consumer<String> second = s -> System.out.println("Second: " + s);
        Consumer<String> both = first.andThen(second);
        both.accept("Hello");
    }
}

```

위 예제에서는 두 개의 `Consumer`, `first`와 `second`를 정의했으며, 각각 문자열의 접두사와 접미사를 출력한다. 그런 다음 `andThen` 메서드를 사용하여 이들을 새로운 `Consumer` 객체 `both`로 조합하고, 문자열 "Hello"에 적용한다.

구체적인 구현은 다음과 같다:

```java
package java.util.function;

import java.util.Objects;

@FunctionalInterface
public interface Consumer<T> {

    /**
     * Performs this operation on the given argument.
     *
     * @param t the input argument
     */
    void accept(T t);

    /**
     * Returns a composed {@code Consumer} that performs, in sequence, this
     * operation followed by the {@code after} operation. If performing either
     * operation throws an exception, it is relayed to the caller of the
     * composed operation.  If performing this operation throws an exception,
     * the {@code after} operation will