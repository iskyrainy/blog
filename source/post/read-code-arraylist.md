---
title: Read Code-ArrayList
category: Tech
tag: [Java, ReadCode]
date: 2025-04-27T09:52:41+08:00
---

# ReadCode-ArrayList

## `ArrayList`实现了`RandomAccess`接口，支持随机访问

RandomAccess是Java中的一个标记接口，用来表示支持快速随机访问的集合。如果一个集合实现了RandomAccess接口，则可以通过索引来直接访问集合中的元素，而不需要进行遍历。反之，如果一个集合没有实现RandomAccess接口，则只能通过迭代器遍历集合中的元素。

在Java中，ArrayList实现了RandomAccess接口，因为它是一个基于数组的集合，可以通过索引直接访问元素。而LinkedList没有实现RandomAccess接口，因为它是一个基于链表的集合，只能通过迭代器遍历元素。

RandomAccess接口本身没有定义任何方法，它只是用来标记一个集合是否支持快速随机访问。如果一个集合实现了RandomAccess接口，则可以通过Collections工具类提供的binarySearch方法来进行二分查找，从而更快地查找元素。

```JAVA
public class ArrayList<E> extends AbstractList<E>
        implements List<E>, RandomAccess, Cloneable, java.io.Serializable
```



## `modCount`详解

在Java集合中，modCount是一个计数器，用于记录集合的结构性修改次数。在集合结构发生变化时，如添加或删除元素，modCount计数器将被增加。例如，ArrayList、HashMap、HashSet等集合类都有一个modCount计数器。

modCount被用来支持集合的快速失败机制。如果在迭代集合时检测到modCount的值已经发生了改变，就会抛出ConcurrentModificationException异常。这是为了避免在并发修改集合时导致数据的不一致性和安全问题。

modCount 属性通常用于实现快速失败（fail-fast）机制，以便在多线程环境下，如果一个集合正在被遍历，而在遍历期间该集合被修改，就可以通过检查 modCount 的值来抛出 ConcurrentModificationException 异常，以保证程序的安全性。

以下是一个示例，展示了在多线程环境下如何使用 modCount 来实现快速失败机制：

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

MyList 类继承了 AbstractList 类，并实现了 add、remove、get 和 size 方法。在 add 和 remove 方法中，modCount 属性都被增加了。在 iterator 方法中，每次遍历前都会检查 modCount 和 expectedModCount 是否相等，如果不相等则抛出 ConcurrentModificationException 异常。

需要注意的是，modCount只能捕获一部分的并发修改异常，例如，如果某个线程删除了一个元素，而另一个线程同时修改了另一个元素，则不会抛出异常。因此，在并发环境下，需要使用专门的并发集合类来保证数据的一致性和线程安全性。



## `ArrayList`默认的大小为10.

```java
private static final int DEFAULT_CAPACITY = 10;
```

可以通过初始化实现自由定义`capacity`大小：

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



## `trimToSize`详解

首先使用三目运算符判断当前 ArrayList 中是否存在元素。如果当前 size 为 0，则将 `elementData` 指向 `EMPTY_ELEMENTDATA`，即长度为 0 的空数组；否则，使用 `Arrays.copyOf()` 方法将 `elementData` 数组中的元素复制到一个新的数组中，并将新数组的长度设置为 size。最终，`elementData` 指向新数组。

这个操作的主要目的是为了减小 ArrayList 对象占用的内存空间。由于 ArrayList 在实际使用过程中，元素的数量和所占用的内存空间可能会不断变化，因此可能会存在大量的空间浪费。调用 `trimToSize()` 方法可以将这些空闲的内存空间释放掉，从而提高程序的内存使用效率。

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



## `grow`详解

如果原`list`非空，使用`newLength()`方法计算新的`list`的大小。

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



## `contains()/lastIndexOf()`详解

如果`o == null`，遍历`elementData`，若存在`null`，返回对应的`index`；如果`o != null`，遍历`elementData`是否包含`o`，返回对应的`index`；其余情况返回`-1`

同理`lastindexof()`原理类似。如果`o == null`，从后往前遍历`elementData`，若存在`null`，返回对应的`index`；如果`o != null`，从后往前遍历`elementData`若存在`o.equals(elementData[i])`，返回对应`index`；其余返回`-1` 。源码不贴了，类似`contains()`

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



## `clone()`详解

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



## `toArray()`详解

接收一个参数 a，表示要将元素转换为的目标数组。如果 a 的长度小于 `ArrayList` 的` size`，那么它会创建一个具有相同类型的新数组，并将 `ArrayList `中的元素复制到该数组中。

如果 a 的长度大于等于 `ArrayList `的 `size`，那么 `ArrayList` 中的元素将被直接复制到 a 中。如果 a 的长度大于 `ArrayList `的` size`，那么 a 中第` size `个元素将设置为` null`。

该方法会返回转换后的数组。注意，如果目标数组的类型不是` ArrayList `的元素类型的子类型，则 `toArray `方法将返回一个新数组。为了防止此情况，可以使用泛型，将目标数组的类型作为` toArray` 方法的参数传递进去。

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



## `set()`详解

检查`index`是否合法，返回先前`index`位置的`element`，不改变`modCount`的值

```java
    public E set(int index, E element) {
        rangeCheck(index);

        E oldValue = elementData(index);
        elementData[index] = element;
        return oldValue;
    }
```



## `remove()`详解

使用`arraycopy()`将`index`后的向前复制挪动，时间复杂度`O(N)`

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

easy to understand.

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



## `equals()`详解

object `o`如果等于`this`指向的对象，直接返回`true`；

如果`o`不是`List`及其子类的实例，返回`false`；

如果`o`是`ArrayList`的一个实例，调用`equalsArrayList()`，否则调用`equalsRange()`；

对`modCount`进行检查，若`modCount != expectedModCount`则抛出`ConcurrentModificationException`异常

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



## `hashCode()`详解

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



## `addAll()`详解

若`a = c.toArray()`为空，返回`false`；若`a`非空，且`a.length > (elementData.length - size)`，调用`grow()`对`elementData`进行扩容，然后使用`arraycopy()`将`a`复制到`elementData`

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



## `batchRemove()`详解

该方法接收一个`Collection`类型的参数`c`，一个boolean类型的参数`complement`，一个int类型的参数`from`和一个int类型的参数`end`。其中，`c`表示要删除的元素集合，`complement`表示如果为true，则删除c中不存在的元素，否则删除c中存在的元素。from和end表示要删除元素的起始位置和结束位置，包含from但不包含end。

首先，该方法会根据complement的值确定r的初始值，如果r指向的元素不需要删除，则将r继续向右移动直到找到需要删除的元素，此时r指向第一个需要删除的元素，w指向下一个元素的位置。

然后，在从r开始的后续元素中找到不需要删除的元素，将其移动到w所在的位置，同时将w向右移动一个位置。当遍历完指定范围内的所有元素后，此时w指向的位置为下一个不需要删除的元素的位置，即w及其右侧的元素需要删除。

最后，将元素数组中从w到end的元素向左移动w - end个位置，同时更新modCount以表示对ArrayList的修改次数。

`example:`

假设我们有一个存储数字的ArrayList，内容如下：

```java
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

我们要删除其中所有偶数元素（即2、4、6、8、10）。我们可以创建一个存储偶数的HashSet，然后将其作为参数传递给batchRemove方法。具体代码如下：

```java
ArrayList<Integer> list = new ArrayList<>(Arrays.asList(1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
HashSet<Integer> set = new HashSet<>(Arrays.asList(2, 4, 6, 8, 10));
list.batchRemove(set, false, 0, list.size());
```

其中，第一个参数是存储偶数的HashSet，第二个参数是false，表示删除所有在HashSet中的元素，第三个参数是0，表示从列表头开始扫描，第四个参数是列表的大小，表示扫描到列表尾。

在batchRemove方法内部，首先通过循环找到第一个需要删除的元素的位置，然后从这个位置开始，将不需要删除的元素往前移动，最后删除剩余的元素。具体过程如下：

1. 从位置0开始扫描，找到元素1，不需要删除，继续扫描。
2. 从位置1开始扫描，找到元素2，需要删除，跳出循环。
3. 记录位置1为r，从位置2开始，将不需要删除的元素1往前移动一个位置，将位置1的元素2覆盖掉。

```java
[1, 3, 4, 5, 6, 7, 8, 9, 10, 10]
   r
   w
```

4. 从位置2开始扫描，找到元素3，不需要删除，将其移动到位置w（1），w自增1。

```java
[1, 3, 4, 5, 6, 7, 8, 9, 10, 10]
   r
      w
```

5. 从位置3开始扫描，找到元素4，需要删除，跳过。

6. 从位置4开始扫描，找到元素5，不需要删除，将其移动到位置w（2），w自增1。

```java
[1, 3, 5, 5, 6, 7, 8, 9, 10, 10]
   r
         w
```

7. 从位置5开始扫描，找到元素6，需要删除，跳过。

8. 从位置6开始扫描，找到元素7，不需要删除，将其移动到位置w（3），w自增1。

```java
[1, 3, 5, 7, 6, 7, 8, 9, 10, 10]
   r
            w
```

go on until over `try` block.

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



## `shiftTailOverGap()`详解

`shiftTailOverGap(Object[] es, int lo, int hi)`是用来删除从`lo`到`gi`部分的元素。

```java
    private void shiftTailOverGap(Object[] es, int lo, int hi) {
        // put elements, which are from hi to size-1, to the 'lo'. array will change from [1, 2, 3, ... , lo, ... , hi, ... size-1] to [1, 2, 3, ... , lo-1, hi, ... , size-1].
        System.arraycopy(es, hi, es, lo, size - hi);
        // tag useless pos as null, let GC take it over.
        for (int to = size, i = (size -= hi - lo); i < to; i++)
            es[i] = null;
    }
```



## `writeObject()/readObject()`详解

### 序列化和反序列化

序列化和反序列化是指将一个对象转化为字节流并传输，以及将字节流重新还原成对象的过程。

序列化是指将一个Java对象转化为字节流，以便将其存储在磁盘上或者通过网络传输到其他地方。序列化可以用于数据持久化、远程通信等场景。在Java中，实现序列化可以通过实现Serializable接口来完成。

反序列化是指将字节流重新还原成对象的过程，以便使用这个对象。在Java中，反序列化可以通过ObjectInputStream类来实现。在进行反序列化时，需要保证字节流和类加载器的正确性，否则可能会出现ClassNotFoundException等异常。

需要注意的是，在进行序列化和反序列化时，可能会涉及到对象图的问题。如果一个对象包含了其他对象的引用，那么在序列化和反序列化时，需要保证整个对象图都能正确地被序列化和反序列化，否则可能会出现数据不一致等问题。因此，在进行序列化和反序列化时，需要对整个对象图进行考虑。

| 优点                                                         | 缺点                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| 可以将对象以二进制流的形式进行持久化，实现对象的远程传输     | 序列化后的对象比较笨重，占用空间大                           |
| 可以在不同平台、不同语言之间传输数据，实现跨语言通信         | 对象的序列化和反序列化操作耗费时间和性能                     |
| 方便进行对象的存储和读取，如缓存、日志记录等                 | 序列化后的对象在传输过程中，容易被中间人攻击，因此需要进行加密和认证 |
| 可以实现深拷贝，即将一个对象完整地复制一份，不影响原有对象的状态 | 如果对象的属性变动较大，反序列化时可能出现类版本不一致的问题，需要进行版本兼容性处理 |
| 对象的状态被保存，可以在需要的时候进行反序列化，恢复对象的状态 | 如果序列化时保存了敏感信息，反序列化时容易泄漏数据隐私       |
| 序列化和反序列化实现了对象的自我描述，方便进行元信息的处理   | 如果序列化后的对象需要进行压缩和解压缩，可能会导致性能和空间占用问题 |

### 方法说明

ArrayList的`writeObject`方法是用来将ArrayList实例序列化为字节流的。它被用于在内存和磁盘之间传输对象、跨网络传输对象等等。

在Java中，一个对象需要进行序列化，需要实现`Serializable`接口。在序列化时，Java会将对象转换为字节序列，而在反序列化时，Java会将字节序列还原为原始对象。ArrayList实现了Serializable接口，因此它可以被序列化。

在ArrayList中，当需要将一个ArrayList实例序列化时，writeObject方法会将ArrayList实例的元素一个一个地写入ObjectOutputStream中，序列化过程中，ArrayList的"容量"不会被序列化，只有ArrayList的元素被序列化。同时，ArrayList在反序列化时会使用`readObject`方法来从ObjectInputStream中读取元素，并重新构建ArrayList对象。

需要注意的是，ArrayList中的元素也必须是可序列化的对象。如果元素是不可序列化的对象，则在序列化过程中会抛出NotSerializableException异常。

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

在 Java 中，`Consumer` 是一个函数式接口，它包含一个抽象方法 `void accept(T t)`，该方法接收一个参数，并且不返回任何结果。`Consumer` 接口通常用于对一个对象进行操作，例如修改对象的状态或将其打印出来。下面是一个简单的例子，使用 `Consumer` 打印一个整数列表中的每个元素：

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

在上面的例子中，我们创建了一个整数列表，并定义了一个 `Consumer` 对象 `printer`，该对象将打印每个元素。然后我们使用 `forEach` 方法遍历列表，并对每个元素执行 `accept` 方法，传递该元素给 `printer` 对象。

`Consumer` 接口还有一些默认方法可以用于组合多个 `Consumer`，例如 `andThen` 方法，该方法将两个 `Consumer` 组合成一个，并依次执行它们的 `accept` 方法。例如：

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

在上面的例子中，我们定义了两个 `Consumer`，`first` 和 `second`，它们分别打印字符串的前缀和后缀。然后我们使用 `andThen` 方法将它们组合成一个新的 `Consumer` 对象 `both`，并将其应用于字符串 "Hello"。

具体实现如下：

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
     * the {@code after} operation will not be performed.
     *
     * @param after the operation to perform after this operation
     * @return a composed {@code Consumer} that performs in sequence this
     * operation followed by the {@code after} operation
     * @throws NullPointerException if {@code after} is null
     */
    default Consumer<T> andThen(Consumer<? super T> after) {
        Objects.requireNonNull(after);
        return (T t) -> { accept(t); after.accept(t); };
    }
}
```



## `forEach(Consumer<? super E> action)`详解

`forEach()`接收一个`Consumer`对象，并对`elementData`中的元素循环调用`action.accept(elementData[i])`，实现对`elementData`的遍历。

```java
    @Override
    public void forEach(Consumer<? super E> action) {
        Objects.requireNonNull(action);
        final int expectedModCount = modCount;
        @SuppressWarnings("unchecked")
        final E[] elementData = (E[]) this.elementData;
        final int size = this.size;
        for (int i=0; modCount == expectedModCount && i < size; i++) {
            action.accept(elementData[i]);
        }
        if (modCount != expectedModCount) {
            throw new ConcurrentModificationException();
        }
    }
```



## `spliterator()`

`spliterator()` 是一个默认方法，定义在 `java.util.Collection` 接口中，用于支持集合的分割迭代。

它返回一个 `Spliterator` 对象，用于在集合中进行分割迭代操作。`Spliterator` 是一个用于遍历和拆分元素的接口，支持并行操作。

`spliterator()` 方法的默认实现使用了 `Spliterators.spliterator()` 方法创建了一个新的 `Spliterator` 对象，用于对整个集合进行分割迭代。

如果实现 `Collection` 接口的类有更好的分割策略，它可以重写 `spliterator()` 方法以返回更好的 `Spliterator` 对象。例如，对于 `ArrayList`，它的 `spliterator()` 方法返回的是一个 `ArrayListSpliterator` 对象，该对象使用了更高效的分割策略来遍历数组。

`Spliterator` 接口中定义了一些方法，用于支持分割迭代的操作。常见的方法包括：

- `tryAdvance(Consumer<? super T> action)`：尝试对下一个元素执行指定的操作，并返回是否还有剩余元素。
- `forEachRemaining(Consumer<? super T> action)`：对剩余所有元素执行指定的操作。
- `trySplit()`：首先判断是否还有元素可供划分，如果剩余元素数量小于等于 1，或者当前已经被划分为子分区，则返回 `null`。否则，它会计算子分区的大小，并将当前分区的 `fence` 更新为子分区的 `origin`。返回一个新的 `Spliterator` 对象，用于遍历后半部分的元素。如果无法分割，则返回 null。
- `estimateSize()`：估计还有多少元素需要遍历。
- `characteristics()`：获取 `Spliterator` 的特性标志。例如，是否支持并行迭代、是否有序等。

使用 `spliterator()` 方法可以对集合进行分割迭代操作，非常适合于对大型集合进行并行处理。





## `nBits(int n)`详解

根据参数n，返回n大小的位图数组。

```java
    private static long[] nBits(int n) {
        // 'n-1' because the array start from index zero;
        // '(n-1) >> 6' because long type has 64 bits;
        // '+1' is to get the int nums.
        return new long[((n - 1) >> 6) + 1];
    }
```



## `setBit(long [] bits, int i)`详解

对位图进行标记。

```java
    private static void setBit(long[] bits, int i) {
        // i's pos is computed by 'i >> 6';
        // from '1L << i' get a nums with just first legel bit is '1';
        // compute two nums with '|', set tag in bits-map.
        bits[i >> 6] |= 1L << i;
    }
```



## `isClear(long[] bits, int i)`详解

与`setBit`相反，根据输入的参数i，消除对应位图中的tag。

```java
    private static boolean isClear(long[] bits, int i) {
        // i's pos is computed by 'i >> 6';
        // from '1L << i' get a nums with just first legel bit is '1';
        // compute two nums with '&', clear tag in bits-map.
        return (bits[i >> 6] & (1L << i)) == 0;
    }
```



## `removeIf(Predicate<? super E> filter)`

`removeIf()` 方法是 Java 集合框架中的一种实用工具，可以基于某些条件删除集合中的元素。该方法是从 Java 8 开始引入的，在 `Collection` 接口中定义。该方法接收一个 `Predicate` 对象作为参数，该对象描述了集合中应该删除的元素的条件。

该方法返回一个布尔值，表示是否对集合进行了更改。示例：

```java
 		ArrayList<String> aList = new ArrayList<>();
        aList.add("both");
        aList.add("side");
        aList.add("way");
        Consumer<String> both = s -> System.out.println(s);
		Predicate<String> predicate = s -> s.equals("both");
        aList.forEach(both);
        aList.removeIf(predicate);
        aList.forEach(both);

        // 输出结果
        /***
         * both
         * side
         * way
         * side
         * way
         */
```

在 `removeIf()` 方法的实现中，它将遍历集合中的每个元素，并根据给定的谓词来决定是否删除它。如果谓词返回 `true`，则删除该元素。如果谓词返回 `false`，则将保留该元素。因此，谓词可以基于某些条件来确定是否删除集合中的元素。

在此过程中，集合框架会自动地处理删除操作。这意味着它会将所有需要删除的元素移动到集合的末尾，然后将集合的大小相应地减小。因此，该方法是在原地进行的，并且具有**常数时间复杂度**。

```java
    @Override
    public boolean removeIf(Predicate<? super E> filter) {
        return removeIf(filter, 0, size);
    }

    boolean removeIf(Predicate<? super E> filter, int i, final int end) {
        Objects.requireNonNull(filter);
        int expectedModCount = modCount;
        final Object[] es = elementData;
        // Optimize for initial run of survivors
        for (; i < end && !filter.test(elementAt(es, i)); i++)
            ;
        // Tolerate predicates that reentrantly access the collection for
        // read (but writers still get CME), so traverse once to find
        // elements to delete, a second pass to physically expunge.
        if (i < end) {
            final int beg = i;
            final long[] deathRow = nBits(end - beg);
            deathRow[0] = 1L;   // set bit 0
            for (i = beg + 1; i < end; i++)
                if (filter.test(elementAt(es, i)))
                    setBit(deathRow, i - beg);
            if (modCount != expectedModCount)
                throw new ConcurrentModificationException();
            modCount++;
            int w = beg;
            for (i = beg; i < end; i++)
                if (isClear(deathRow, i - beg))
                    es[w++] = es[i];
            // elements those need be deleted will moved to the tail of list.
            shiftTailOverGap(es, w, end);
            return true;
        } else {
            if (modCount != expectedModCount)
                throw new ConcurrentModificationException();
            return false;
        }
    }
```



## `replaceAll(UnaryOperator<E> operator)`详解

`replaceAll(UnaryOperator<E> operator)` 是一个Java集合类中的方法，用于替换集合中的所有元素。该方法需要一个实现了 `UnaryOperator<E>` 接口的参数，该接口包含一个名为 `apply()` 的方法，接受一个泛型参数E并返回一个E类型的结果。该方法可以被用于转换集合中的所有元素。

示例：

```java
        UnaryOperator<Integer> uOperator = s -> ++s;
        ArrayList<Integer> aList2 = new ArrayList<>();
        aList2.add(1);
        aList2.add(2);
        aList2.add(3);
        Consumer<Integer> both2 = s -> System.out.println(s);
        aList2.forEach(both2);
        aList2.replaceAll(uOperator);
        aList2.forEach(both2);
		
		// output:
		/***
		 * 1
         * 2
         * 3
         * 2
         * 3
         * 4
         */
```

需要注意的是，使用 `replaceAll()` 方法不会更改集合的大小，它只会更改集合中的元素。

```java
    @Override
    public void replaceAll(UnaryOperator<E> operator) {
        replaceAllRange(operator, 0, size);
        // TODO(8203662): remove increment of modCount from ...
        modCount++;
    }

    private void replaceAllRange(UnaryOperator<E> operator, int i, int end) {
        Objects.requireNonNull(operator);
        final int expectedModCount = modCount;
        final Object[] es = elementData;
        for (; modCount == expectedModCount && i < end; i++)
            es[i] = operator.apply(elementAt(es, i));
        if (modCount != expectedModCount)
            throw new ConcurrentModificationException();
    }
```



## `sort(Comparator<? super E> c)`详解

方法中接收一个 Comparator 类型的参数 c，用于比较 ArrayList 中的元素大小。方法主要流程如下：

1. 获取 ArrayList 的 modCount 属性值，用于判断 ArrayList 是否被修改过。
2. 调用 Java 的 Arrays 类的 sort 方法对 ArrayList 中的元素进行排序，sort 方法使用了 Dual-Pivot Quicksort 算法进行排序。
3. 排序完成后，判断 ArrayList 的 modCount 是否与之前获取的值相同，如果不同则说明 ArrayList 在排序过程中被修改过，抛出 ConcurrentModificationException 异常。
4. 如果 modCount 没有发生变化，则将 modCount 属性值加 1。

需要注意的是，该方法使用的排序算法是 Dual-Pivot Quicksort，而不是 TimSort。Dual-Pivot Quicksort 是 JDK7 引入的一种排序算法，主要适用于大型数组的排序。在一些情况下，Dual-Pivot Quicksort 的排序效率比 TimSort 更高。但在一些其他情况下，TimSort 的排序效率更高。

示例：

```java
        Comparator<Integer> comparator = (o1, o2) -> -Integer.compare(o1, o2);
        aList2.clear();
        aList2.add(100);
        aList2.add(2189);
        aList2.add(1);
        aList2.add(-1);
        aList2.forEach(both2);
        aList2.sort(comparator);
        aList2.forEach(both2);

		// output:
		/***
		 * 100
         * 2189
         * 1
         * -1
         * 2189
         * 100
         * 1
         * -1
         */
```



```java
    @Override
    @SuppressWarnings("unchecked")
    public void sort(Comparator<? super E> c) {
        final int expectedModCount = modCount;
        Arrays.sort((E[]) elementData, 0, size, c);
        if (modCount != expectedModCount)
            throw new ConcurrentModificationException();
        modCount++;
    }
```



## `checkInvariants()`详解

这是`ArrayList`类中的一个用于检查数据结构不变性的私有方法。它通常在`ArrayList`的各种操作中调用，以确保数据结构的一致性和完整性。在这个特定的实现中，该方法包含两个断言语句，用于检查`ArrayList`的两个不变性:

1. `size`的值不小于0。
2. `elementData`数组的长度等于`size`或者`elementData[size]`为空。

这些不变性在数据结构的操作中非常重要，因为它们确保了`ArrayList`的正确性和一致性。通过检查它们，可以在开发和调试过程中更轻松地发现和修复潜在的错误。

```java
    void checkInvariants() {
        // assert size >= 0;
        // assert size == elementData.length || elementData[size] == null;
    }
```
