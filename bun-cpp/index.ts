import './setup';

// const out = await Bun.cpp`
// #include <iostream>
// #include <vector>
// using namespace std;
// int main() {
//     vector<int> nums = {1, 2, 3, 4, 5};
//     int sq_sum = 0;
//     for (int n : nums) sq_sum += n * n;
//     cout << "sum of squares = " << sq_sum << endl;
//     return 0;
// }
// // `;

// const out = await Bun.cpp`
// #include <iostream>
// #include <map>
// #include <string>
// using namespace std;
// int main() {
//     map<string, int> freq;
//     string words[] = {"apple", "banana", "apple", "pear"};
//     for (auto &w : words) freq[w]++;
//     for (auto &p : freq) cout << p.first << " => " << p.second << endl;
//     return 0;
// }
// `;

// const out = await Bun.cpp`
// #include <iostream>
// #include <algorithm>
// #include <vector>
// using namespace std;
// int main() {
//     vector<int> arr = {5, 2, 8, 1, 3};
//     sort(arr.begin(), arr.end(), [](int a, int b) { return a > b; });
//     cout << "sorted descending:";
//     for (int v : arr) cout << " " << v;
//     cout << endl;
//     return 0;
// }
// `;

// const out = await Bun.cpp`
// #include <iostream>
// using namespace std;
// class Greeter {
// public:
//     Greeter(string name): name(name) {}
//     void say() { cout << "Hello, " << name << "!" << endl; }
// private:
//     string name;
// };
// int main() {
//     Greeter g("Parbez");
//     g.say();
//     return 0;
// }
// `;

// const out = await Bun.cpp`
// // recursion demo
// #include <iostream>
// using namespace std;
// int fact(int n) {
//     if (n <= 1) return 1;
//     return n * fact(n - 1);
// }
// int main() {
//     cout << "factorial(6) = " << fact(6) << endl;
//     return 0;
// }
// `;

const element = 5;
const elements = [3, 1, 5, 2];

// Reference js variables
const out = await Bun.cpp`
    vector<int> elements = ${elements};
    int element = ${element};
    auto findElem = [element](int x) { return x == element; };
    auto it = std::find_if(begin(elements), end(elements), findElem);
    if (it != end(elements)) {
        cout << "Element found: " << *it << endl;
        return 0;
    } else {
        cout << "Element not found" << endl;
        return 1;
    }
`;

console.log(out.unwrap());
